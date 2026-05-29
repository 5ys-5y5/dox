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
  TemplateCanvasSelectedBox,
  TemplateCanvasSelectionChangeOptions,
  TemplateEditWorkspaceProps,
  TemplateEditWorkspaceSaveDraftParams,
} from '../../components/template/workspace/types';
import {
  TemplateExtractWorkspace,
  type TemplateExtractWorkspaceStatus,
} from '../../components/template/TemplateExtractWorkspace';
import { CanvasOwnedWorkspace, type CanvasOwnerSurface } from './ownerPolicy';
import {
  applyCanvasOwnerSettingsToWorkspaceProps,
  buildCanvasToolbarVisibility,
  buildPersistenceVisibility,
  buildTemplateUsagePreviewLayoutDebugOptions,
  createEmptyCanvasOwnerSettingsStore,
  normalizeCanvasOwnerSettingsOverrides,
  normalizeCanvasOwnerSettingsStore,
  readCanvasOwnerSettingsFromStorage,
  resolveCanvasOwnerSettings,
  resolveCanvasOwnerSettingDiagnostics,
  resolveCanvasOwnerUiFeatureDiagnostics,
  saveCanvasOwnerSettingsStoreToStorage,
  updateCanvasOwnerSettingsStoreOverride,
  type CanvasOwnerSettings,
  type CanvasOwnerSettingDiagnostic,
  type CanvasOwnerSettingKey,
  type CanvasOwnerSettingSource,
  type CanvasOwnerSettingsStore,
  type CanvasOwnerUiFeatureDiagnostic,
} from './ownerSettings';
import { resolveCanvasOwnerRouteWorkspaceProps } from './ownerRouteContract';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Divider } from '../../components/ui/Divider';
import { EntityPicker, type EntityPickerOption } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import { OptionButtonGroup } from '../../components/ui/OptionButtonGroup';
import {
  OwnerSettingsActionBar,
  OwnerSettingsManagedTargetControls,
  OwnerSettingsSectionHeader,
} from '../../components/ui/OwnerSettingsLayout';
import { OwnerSharedUiPreview } from '../../components/ui/OwnerSharedUiPreview';
import { SettingToggleRow } from '../../components/ui/SettingToggleRow';
import {
  extractDocumentCanvasLabelValuesFromHtml,
  mergeDocumentCanvasLabelValues,
  materializeDocumentCanvasHtml,
  stringifyDocumentValue,
} from '../../lib/documentCanvasState';
import { watchOwnerUnnamedElements } from '../../lib/ownerDomNaming';
import type { DocumentDetailResult, DocumentListItem, DocumentRequestTaskDto } from '../../lib/documentDtos';
import type { DocumentMemberRecordDto, SiteMemberRecordDto } from '../../lib/memberAccessDtos';
import { buildOwnerWorkspaceDocumentDetailPath, buildPickerDocumentListPath } from '../../lib/documentApiPaths';
import { buildDocumentHtmlContentKey } from '../../lib/documentCanvasHtml';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../lib/documentAttachmentValues';
import type { TemplateRecordDto } from '../../lib/templateDtos';

const MemoOwnerSharedUiPreview = React.memo(OwnerSharedUiPreview);

type ManagedCanvasPageId =
  | 'canvas'
  | 'templates'
  | 'templates-edit'
  | 'project'
  | 'request-links'
  | 'member-access'
  | 'templates-extract-preview';
type ManagedCanvasPage = {
  id: ManagedCanvasPageId;
  label: string;
  path: string;
  surface: CanvasOwnerSurface;
  description: string;
  usesTemplateList: boolean;
  documentSaveEnabled: boolean;
  readOnlyCanvasOutput: boolean;
};
type EffectivePropBooleanControl = {
  settingKey: CanvasOwnerSettingKey;
  trueValue: CanvasOwnerSettings[CanvasOwnerSettingKey];
  falseValue: CanvasOwnerSettings[CanvasOwnerSettingKey];
  trueLabel?: string;
  falseLabel?: string;
};
type EffectiveTemplateWorkspacePropRow = {
  section: string;
  name: string;
  value: string;
  description: string;
  booleanControl?: EffectivePropBooleanControl;
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

const canvasRequestTaskKindLabels: Record<DocumentRequestTaskDto['kind'], string> = {
  value: '기록값',
  signature: '서명',
  photo: '필수 사진',
  file: '필수 파일',
};

const normalizeCanvasTaskTagNames = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，\n]/g)
      : [];

  return Array.from(
    new Set(rawValues.map((tagName) => String(tagName || '').trim()).filter((tagName) => Boolean(tagName)))
  );
};

const readCanvasTaskPayloadText = (task: DocumentRequestTaskDto, key: string) => {
  const value = task.payload?.[key];

  return typeof value === 'string' ? value.trim() : '';
};

const readCanvasTaskTagNames = (task: DocumentRequestTaskDto) =>
  normalizeCanvasTaskTagNames(
    task.payload?.tags ?? task.payload?.tagNames ?? readCanvasTaskPayloadText(task, 'tagName')
  );

const normalizeCanvasTaskTagColor = (value: unknown, fallback = '#10b981') => {
  const normalizedValue = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalizedValue) ? normalizedValue.toLowerCase() : fallback;
};

const readCanvasTaskTagColor = (task: DocumentRequestTaskDto, tagName: string) => {
  const tagColors = task.payload?.tagColors;

  if (tagColors && typeof tagColors === 'object' && !Array.isArray(tagColors)) {
    const value = (tagColors as Record<string, unknown>)[tagName];
    const normalizedValue = normalizeCanvasTaskTagColor(value, '');

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return normalizeCanvasTaskTagColor(task.payload?.tagColor, task.kind === 'file' ? '#2563eb' : '#10b981');
};

const buildCanvasMemberLabelById = (
  documentMembers: DocumentMemberRecordDto[],
  siteMembers: SiteMemberRecordDto[]
) => {
  const nextMap: Record<string, string> = {};

  [...siteMembers, ...documentMembers].forEach((membership) => {
    const member = membership.member;
    const memberId = String(member.id || '').trim();

    if (!memberId) {
      return;
    }

    nextMap[memberId] = member.displayName?.trim() || member.phoneNumber || memberId;
  });

  return nextMap;
};

const canvasOwnerItem = (item: string, name: string) => ({
  'data-canvas-owner-item': item,
  'data-canvas-owner-name': name,
  env: '',
});

const canvasOwnerEnv = (definitionName = '') => ({ env: definitionName });

const canvasOwnerItemAttribute = 'data-canvas-owner-item';
const canvasOwnerNameAttribute = 'data-canvas-owner-name';
const canvasOwnerAutoNamedAttribute = 'data-canvas-owner-auto-named';

const defaultManagedCanvasPages: ManagedCanvasPage[] = [
  {
    id: 'canvas',
    label: '공용 캔버스 관리자',
    path: '/canvas',
    surface: 'canvas',
    description: '공용 캔버스 owner 설정을 검증하는 기준 페이지입니다.',
    usesTemplateList: true,
    documentSaveEnabled: false,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'templates',
    label: '템플릿 생성',
    path: '/templates',
    surface: 'templates',
    description: 'PDF 추출과 템플릿 저장을 포함한 템플릿 작성 페이지입니다.',
    usesTemplateList: true,
    documentSaveEnabled: false,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'templates-edit',
    label: '템플릿 편집',
    path: '/templates/edit',
    surface: 'templates-edit',
    description: '저장된 템플릿을 직접 편집하는 페이지입니다.',
    usesTemplateList: true,
    documentSaveEnabled: false,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'project',
    label: '현장 관리',
    path: '/project',
    surface: 'project',
    description: '현장 문서의 페이지별 환경설정 적용 결과와 공용 캔버스 출력을 확인하는 화면입니다.',
    usesTemplateList: false,
    documentSaveEnabled: true,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'request-links',
    label: '요청 링크',
    path: '/request-links/[token]',
    surface: 'request-links',
    description: '요청 링크 상태에 따라 허용된 값만 입력하거나 읽기 전용으로 확인합니다.',
    usesTemplateList: false,
    documentSaveEnabled: true,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'member-access',
    label: '구성원 문서 접근',
    path: '/member-access/document/[documentId]',
    surface: 'member-access',
    description: '초대된 권한에 따라 문서를 편집하거나 읽기 전용으로 여는 페이지입니다.',
    usesTemplateList: false,
    documentSaveEnabled: true,
    readOnlyCanvasOutput: false,
  },
  {
    id: 'templates-extract-preview',
    label: '템플릿 추출 미리보기',
    path: '/templates/extract',
    surface: 'templates-extract-preview',
    description: 'PDF 추출 결과를 읽기 전용 공용 캔버스로 확인합니다.',
    usesTemplateList: false,
    documentSaveEnabled: false,
    readOnlyCanvasOutput: true,
  },
];

const normalizeManagedCanvasPageId = (value: string | null | undefined): ManagedCanvasPageId =>
  defaultManagedCanvasPages.some((page) => page.id === value) ? (value as ManagedCanvasPageId) : 'canvas';

const getManagedCanvasPageFromList = (pages: ManagedCanvasPage[], pageId: ManagedCanvasPageId) =>
  pages.find((page) => page.id === pageId) || pages[0];

const compactInputClassName = 'h-8 px-2 text-xs';

export default function CanvasOwnerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canvasOwnerRootRef = React.useRef<HTMLElement | null>(null);
  const selectedManagedPageId = normalizeManagedCanvasPageId(searchParams.get('page'));
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';
  const documentIdFromQuery = searchParams.get('documentId')?.trim() || '';

  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [documentRequestTasks, setDocumentRequestTasks] = React.useState<DocumentRequestTaskDto[]>([]);
  const [documentTaskMemberLabelById, setDocumentTaskMemberLabelById] = React.useState<Record<string, string>>({});
  const [loadingLists, setLoadingLists] = React.useState(false);
  const [templatesLoaded, setTemplatesLoaded] = React.useState(false);
  const [documentsLoaded, setDocumentsLoaded] = React.useState(false);
  const [loadingDocumentDetail, setLoadingDocumentDetail] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [ownerEventMessage, setOwnerEventMessage] = React.useState<string | null>(null);
  const [previewSelectedCanvasBoxes, setPreviewSelectedCanvasBoxes] = React.useState<TemplateCanvasSelectedBox[]>([]);
  const [extractStatus, setExtractStatus] = React.useState<TemplateExtractWorkspaceStatus | null>(null);
  const [extractStatusResetKey, setExtractStatusResetKey] = React.useState(0);
  const [draftReloadNonce, setDraftReloadNonce] = React.useState(0);
  const [savedSettingsStore, setSavedSettingsStore] = React.useState<CanvasOwnerSettingsStore>(() =>
    createEmptyCanvasOwnerSettingsStore()
  );
  const [settingsStore, setSettingsStore] = React.useState<CanvasOwnerSettingsStore>(() =>
    createEmptyCanvasOwnerSettingsStore()
  );
  const [canvasSettingsLoaded, setCanvasSettingsLoaded] = React.useState(false);
  const [settingsImportSourcePageId, setSettingsImportSourcePageId] = React.useState('');
  const managedCanvasPages = React.useMemo<ManagedCanvasPage[]>(() => defaultManagedCanvasPages, []);
  const selectedManagedPage = getManagedCanvasPageFromList(managedCanvasPages, selectedManagedPageId);
  const usesTemplateList = selectedManagedPage.usesTemplateList;
  const documentSaveEnabled = selectedManagedPage.documentSaveEnabled;
  const readOnlyCanvasOutput = selectedManagedPage.readOnlyCanvasOutput;
  const settingsImportOptions = React.useMemo<EntityPickerOption[]>(
    () =>
      managedCanvasPages
        .filter((page) => page.id !== selectedManagedPage.id)
        .map((page) => ({
          id: page.id,
          label: page.label,
          meta: page.path,
          keywords: [page.id, page.surface, page.path],
        })),
    [managedCanvasPages, selectedManagedPage.id]
  );

  const selectedTemplateId = templateIdFromQuery || templates[0]?.id || '';
  const selectedDocumentId = documentIdFromQuery || documents[0]?.document.id || '';
  const settingsSignature = React.useMemo(() => JSON.stringify(settingsStore), [settingsStore]);
  const savedSettingsSignature = React.useMemo(() => JSON.stringify(savedSettingsStore), [savedSettingsStore]);
  const hasUnsavedCanvasSettings = settingsSignature !== savedSettingsSignature;
  const canEditCurrentWorkspace = !readOnlyCanvasOutput;
  const resolvedSettings = React.useMemo(
    () =>
      resolveCanvasOwnerSettings(settingsStore, {
        pageId: selectedManagedPage.id,
      }),
    [selectedManagedPage.id, settingsStore]
  );
  const settings = resolvedSettings.settings;
  const settingSources = resolvedSettings.sources;
  const previewResolvedSettings = React.useMemo(
    () =>
      resolveCanvasOwnerSettings(settingsStore, {
        pageId: selectedManagedPage.id,
      }),
    [selectedManagedPage.id, settingsStore]
  );
  const previewSettings = previewResolvedSettings.settings;
  const previewSettingSources = previewResolvedSettings.sources;
  const workspacePreviewSettings = React.useDeferredValue(previewSettings);
  const workspacePreviewSettingSources = React.useDeferredValue(previewSettingSources);

  React.useEffect(() => {
    const canvasRoot = canvasOwnerRootRef.current;

    if (!canvasRoot) {
      return undefined;
    }

    return watchOwnerUnnamedElements({
      root: canvasRoot,
      itemAttribute: canvasOwnerItemAttribute,
      nameAttribute: canvasOwnerNameAttribute,
      autoNamedAttribute: canvasOwnerAutoNamedAttribute,
      itemPrefix: 'canvas',
      mutationDelayMs: 700,
      pauseAfterPointerDownMs: 2500,
    });
  }, []);

  React.useEffect(() => {
    const { settingsStore: nextSettingsStore, hasStoredSettings } = readCanvasOwnerSettingsFromStorage({
      pageId: selectedManagedPage.id,
    });

    if (hasStoredSettings) {
      setSavedSettingsStore(nextSettingsStore);
      setSettingsStore(nextSettingsStore);
    }
    setCanvasSettingsLoaded(true);
  }, [selectedManagedPage.id]);

  const saveCanvasOwnerSettings = React.useCallback(() => {
    const nextSettingsStore = saveCanvasOwnerSettingsStoreToStorage(settingsStore);
    setSavedSettingsStore(nextSettingsStore);
    setSettingsStore(nextSettingsStore);
    setOwnerEventMessage(
      `${selectedManagedPage.label} 상자 편집 캔버스 환경설정을 저장했습니다.`
    );
  }, [selectedManagedPage.label, settingsStore]);

  const resetCanvasOwnerSettings = React.useCallback(() => {
    setSettingsStore(savedSettingsStore);
    setOwnerEventMessage('저장된 상자 편집 캔버스 환경설정으로 되돌렸습니다.');
  }, [savedSettingsStore]);

  const updateSetting = React.useCallback(
    <K extends keyof CanvasOwnerSettings>(key: K, value: CanvasOwnerSettings[K]) => {
      setSettingsStore((previous) =>
        updateCanvasOwnerSettingsStoreOverride(previous, {
          pageId: selectedManagedPage.id,
          key,
          value,
        })
      );
    },
    [selectedManagedPage.id]
  );
  const applyCanvasOwnerSettingUpdates = React.useCallback(
    (
      updates: Array<{
        settingKey: CanvasOwnerSettingKey;
        value: CanvasOwnerSettings[CanvasOwnerSettingKey];
      }>
    ) => {
      if (updates.length === 0) {
        return;
      }

      setSettingsStore((previous) =>
        updates.reduce(
          (nextStore, update) =>
            updateCanvasOwnerSettingsStoreOverride(nextStore, {
              pageId: selectedManagedPage.id,
              key: update.settingKey,
              value: update.value as never,
            }),
          previous
        )
      );
    },
    [selectedManagedPage.id]
  );
  const applySettingDiagnosticFix = React.useCallback(
    (settingDiagnostic: CanvasOwnerSettingDiagnostic) => {
      if (settingDiagnostic.fixes.length === 0) {
        return;
      }

      applyCanvasOwnerSettingUpdates(settingDiagnostic.fixes);
      setOwnerEventMessage(
        `${settingDiagnostic.label} 진단 수정안을 적용했습니다. 저장하려면 환경설정 저장을 누르세요.`
      );
    },
    [applyCanvasOwnerSettingUpdates]
  );
  const applyEffectivePropBooleanControl = React.useCallback(
    (control: EffectivePropBooleanControl, nextValue: CanvasOwnerSettings[CanvasOwnerSettingKey]) => {
      applyCanvasOwnerSettingUpdates([
        {
          settingKey: control.settingKey,
          value: nextValue,
        },
      ]);
      setOwnerEventMessage(`${control.settingKey} 값을 변경했습니다. 저장하려면 환경설정 저장을 누르세요.`);
    },
    [applyCanvasOwnerSettingUpdates]
  );

  const updateQuery = React.useCallback(
    (patch: Partial<Record<'page' | 'templateId' | 'documentId', string>>) => {
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

  const importCanvasSettingsFromPage = React.useCallback(
    (sourcePageId: ManagedCanvasPageId) => {
      if (sourcePageId === selectedManagedPage.id) {
        return;
      }

      const sourcePage = getManagedCanvasPageFromList(managedCanvasPages, sourcePageId);

      setSettingsStore((previous) => {
        const normalizedStore = normalizeCanvasOwnerSettingsStore(previous);
        const sourceResolvedSettings = resolveCanvasOwnerSettings(normalizedStore, {
          pageId: sourcePage.id,
        });

        return {
          ...normalizedStore,
          pageSettings: {
            ...normalizedStore.pageSettings,
            [selectedManagedPage.id]: normalizeCanvasOwnerSettingsOverrides(sourceResolvedSettings.settings),
          },
        };
      });
      setOwnerEventMessage(`${sourcePage.label} 설정을 ${selectedManagedPage.label}에 불러왔습니다.`);
    },
    [managedCanvasPages, selectedManagedPage.id, selectedManagedPage.label]
  );

  const handleSelectSettingsImportSource = React.useCallback(
    (sourcePageId: string) => {
      const normalizedSourcePageId = normalizeManagedCanvasPageId(sourcePageId);

      if (normalizedSourcePageId === selectedManagedPage.id) {
        return;
      }

      setSettingsImportSourcePageId(normalizedSourcePageId);
      importCanvasSettingsFromPage(normalizedSourcePageId);
    },
    [importCanvasSettingsFromPage, selectedManagedPage.id]
  );

  const handlePreviewCanvasSelectionChange = React.useCallback(
    (boxes: TemplateCanvasSelectedBox[], options?: TemplateCanvasSelectionChangeOptions) => {
      setPreviewSelectedCanvasBoxes((current) => {
        if (!options?.append) {
          return boxes;
        }

        const nextById = new Map(current.map((box) => [box.id, box]));
        boxes.forEach((box) => {
          nextById.set(box.id, box);
        });
        return Array.from(nextById.values());
      });
      setOwnerEventMessage(
        boxes.length > 0
          ? `상자 선택 콜백: ${boxes.map((box) => box.label || box.valueKey || box.frameGroupId).join(', ')}`
          : '상자 선택 콜백: 선택 해제'
      );
    },
    []
  );

  React.useEffect(() => {
    if (!canvasSettingsLoaded) {
      return;
    }

    const rawPageId = searchParams.get('page');
    if (rawPageId === selectedManagedPage.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('page', selectedManagedPage.id);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }, [canvasSettingsLoaded, pathname, router, searchParams, selectedManagedPage.id]);

  React.useEffect(() => {
    setPreviewSelectedCanvasBoxes([]);
  }, [selectedDocumentId, selectedManagedPage.id, selectedTemplateId]);

  React.useEffect(() => {
    setSettingsImportSourcePageId('');
  }, [selectedManagedPage.id]);

  const handleSelectManagedPage = React.useCallback(
    (pageId: ManagedCanvasPageId) => {
      const nextPage = getManagedCanvasPageFromList(managedCanvasPages, pageId);
      updateQuery({ page: nextPage.id });
    },
    [managedCanvasPages, updateQuery]
  );

  const loadLists = React.useCallback(async (options: { templates?: boolean; documents?: boolean; force?: boolean } = {}) => {
    const shouldLoadTemplates = Boolean(options.templates ?? usesTemplateList) && (options.force || !templatesLoaded);
    const shouldLoadDocuments = Boolean(options.documents ?? !usesTemplateList) && (options.force || !documentsLoaded);

    if (!shouldLoadTemplates && !shouldLoadDocuments) {
      return;
    }

    setLoadingLists(true);
    try {
      const [templateItems, documentItems] = await Promise.all([
        shouldLoadTemplates
          ? fetchSuccessData<TemplateRecordDto[]>('/api/templates?limit=128')
          : Promise.resolve(null),
        shouldLoadDocuments
          ? fetchSuccessData<DocumentListItem[]>(buildPickerDocumentListPath())
          : Promise.resolve(null),
      ]);

      if (templateItems) {
        setTemplates(templateItems);
        setTemplatesLoaded(true);
      }

      if (documentItems) {
        setDocuments(documentItems);
        setDocumentsLoaded(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '캔버스 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingLists(false);
    }
  }, [documentsLoaded, templatesLoaded, usesTemplateList]);

  React.useEffect(() => {
    void loadLists();
  }, [loadLists]);

  React.useEffect(() => {
    if (usesTemplateList || !selectedDocumentId) {
      setSelectedDocumentDetail(null);
      setDocumentRequestTasks([]);
      setDocumentTaskMemberLabelById({});
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setLoadingDocumentDetail(true);
      try {
        const detail = await fetchSuccessData<DocumentDetailResult>(
          buildOwnerWorkspaceDocumentDetailPath(selectedDocumentId)
        );
        const [requestTasks, documentMembers, siteMembers] = await Promise.all([
          fetchSuccessData<DocumentRequestTaskDto[]>(
            `/api/documents/${encodeURIComponent(selectedDocumentId)}/request-tasks`
          ).catch(() => []),
          fetchSuccessData<DocumentMemberRecordDto[]>(
            `/api/member-access/document-members?documentId=${encodeURIComponent(selectedDocumentId)}`
          ).catch(() => []),
          detail.document.siteId
            ? fetchSuccessData<SiteMemberRecordDto[]>(
                `/api/member-access/site-members?siteId=${encodeURIComponent(detail.document.siteId)}`
              ).catch(() => [])
            : Promise.resolve([] as SiteMemberRecordDto[]),
        ]);

        if (!cancelled) {
          setSelectedDocumentDetail(detail);
          setDocumentRequestTasks(Array.isArray(requestTasks) ? requestTasks : []);
          setDocumentTaskMemberLabelById(buildCanvasMemberLabelById(documentMembers, siteMembers));
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDocumentDetail(null);
          setDocumentRequestTasks([]);
          setDocumentTaskMemberLabelById({});
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
  }, [usesTemplateList, selectedDocumentId]);

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
      draftKey: `${selectedManagedPage.id}:${selectedDocumentDetail.document.id}:${selectedDocumentDetail.latestVersion?.id || 'no-version'}:${buildDocumentHtmlContentKey(draftHtml)}:${draftReloadNonce}`,
      templateName: selectedDocumentDetail.document.title,
      draftHtml,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey,
    };
  }, [
    attachmentFilesByValueKey,
    draftReloadNonce,
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
        buildOwnerWorkspaceDocumentDetailPath(selectedDocumentDetail.document.id)
      );
      setSelectedDocumentDetail(refreshedDetail);
      await loadLists({ documents: true, templates: false, force: true });
      setOwnerEventMessage('문서 저장 콜백이 실행되었습니다.');

      return {
        successMessage: '문서 저장을 완료했습니다.',
      };
    },
    [loadLists, selectedDocumentDetail, selectedDocumentLabelValues]
  );

  const selectedTemplateSummary = templates.find((item) => item.id === selectedTemplateId) || null;
  const editableValueKeyCandidates = React.useMemo(
    () => Object.keys(selectedDocumentLabelValues).filter((key) => String(key || '').trim().length > 0).slice(0, 3),
    [selectedDocumentLabelValues]
  );
  const selectedPageAllowsEditableValueKeys =
    selectedManagedPage.surface === 'canvas' || selectedManagedPage.surface === 'request-links';
  const effectiveEditableValueKeys =
    !canEditCurrentWorkspace ||
    !documentSaveEnabled ||
    !workspacePreviewSettings.limitEditableValueKeys ||
    !selectedPageAllowsEditableValueKeys
      ? null
      : editableValueKeyCandidates;
  const topNotice = workspacePreviewSettings.showTopNotice ? (
    <div
      className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"
      {...canvasOwnerEnv('topNotice')}
    >
      owner page sample `topNotice`가 켜진 상태입니다. 현재 페이지: {selectedManagedPage.label}
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
    usesTemplateList &&
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
          updateQuery({ templateId: result.templateId });
          setOwnerEventMessage(`PDF 추출 저장 완료: ${result.templateId}`);
          void loadLists({ templates: true, documents: false, force: true });
        }}
        onStatusChange={setExtractStatus}
      />
    ) : null;
  const additionalControlPanels = (
    <>
      {templateExtractPanel}
      {workspacePreviewSettings.showAdditionalControlPanels ? (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
      {...canvasOwnerEnv('additionalControlPanels')}
    >
      <div className="font-medium text-slate-900">additionalControlPanels 샘플</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        TemplatePersistencePanel 위에 외부 제어 패널을 삽입하는 public prop 상태를 여기서 확인합니다.
      </p>
    </div>
      ) : null}
    </>
  );
  const documentAttachmentTagOptions = React.useMemo(
    () =>
      Array.from(
        new Set(
          documentRequestTasks
            .filter((task) => task.kind === 'photo' || task.kind === 'file')
            .flatMap(readCanvasTaskTagNames)
        )
      ),
    [documentRequestTasks]
  );
  const documentAttachmentTagColorByName = React.useMemo(() => {
    const nextValue: Record<string, string> = {};

    documentRequestTasks
      .filter((task) => task.kind === 'photo' || task.kind === 'file')
      .forEach((task) => {
        readCanvasTaskTagNames(task).forEach((tagName) => {
          nextValue[tagName] = readCanvasTaskTagColor(task, tagName);
        });
      });

    return nextValue;
  }, [documentRequestTasks]);
  const canvasTodoPanel = React.useMemo(() => {
    const sortedTasks = [...documentRequestTasks].sort((left, right) => {
      const assigneeOrder = left.assigneeMemberId.localeCompare(right.assigneeMemberId, 'ko');

      if (assigneeOrder !== 0) {
        return assigneeOrder;
      }

      return left.targetLabel.localeCompare(right.targetLabel, 'ko');
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">할 일</p>
          </div>
          <Badge variant="slate">{sortedTasks.length}개</Badge>
        </div>
        {sortedTasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
            등록된 할 일이 없습니다.
          </div>
        ) : (
          <div className="grid gap-2">
            {sortedTasks.map((task) => {
              const tagNames = readCanvasTaskTagNames(task);
              const assigneeLabel = documentTaskMemberLabelById[task.assigneeMemberId] || task.assigneeMemberId;
              const kindVariant = task.kind === 'photo' || task.kind === 'file' ? 'green' : task.kind === 'signature' ? 'blue' : 'slate';

              return (
                <div key={task.id} className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{task.targetLabel}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{assigneeLabel}</p>
                    </div>
                    <Badge variant={kindVariant}>{canvasRequestTaskKindLabels[task.kind]}</Badge>
                  </div>
                  {task.kind === 'photo' || task.kind === 'file' ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {tagNames.length > 0 ? (
                        tagNames.map((tagName) => (
                          <Badge
                            key={`${task.id}:tag:${tagName}`}
                            variant="outline"
                            className="max-w-full truncate"
                            style={{
                              borderColor: readCanvasTaskTagColor(task, tagName),
                              backgroundColor: `${readCanvasTaskTagColor(task, tagName)}1a`,
                              color: readCanvasTaskTagColor(task, tagName),
                            }}
                          >
                            {tagName}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="slate">태그 없음</Badge>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [documentRequestTasks, documentTaskMemberLabelById]);
  const effectiveCanvasToolbarVisibility = React.useMemo(
    () => buildCanvasToolbarVisibility(workspacePreviewSettings),
    [workspacePreviewSettings]
  );
  const effectivePersistenceVisibility = React.useMemo(
    () => buildPersistenceVisibility(workspacePreviewSettings),
    [workspacePreviewSettings]
  );
  const templateUsagePreviewLayoutDebugOptions = React.useMemo(
    () => buildTemplateUsagePreviewLayoutDebugOptions(workspacePreviewSettings),
    [workspacePreviewSettings]
  );
  const previewDocumentId = selectedDocumentDetail?.document.id || selectedDocumentId;
  const routeContractAdditionalControlPanels =
    selectedManagedPage.id === 'templates'
      ? templateExtractPanel
      : selectedManagedPage.id === 'canvas'
        ? additionalControlPanels
        : undefined;
  const routeContractTopNotice =
    selectedManagedPage.id === 'templates'
      ? extractStatusNotice
      : selectedManagedPage.id === 'canvas'
        ? topNotice
        : undefined;
  const routeContractDocumentAttachmentApiPath =
    previewDocumentId && canEditCurrentWorkspace && documentSaveEnabled
      ? selectedManagedPage.id === 'project'
        ? `/api/documents/${encodeURIComponent(previewDocumentId)}/attachments`
        : selectedManagedPage.id === 'member-access'
          ? `/api/member-access/documents/${encodeURIComponent(previewDocumentId)}/attachments`
          : selectedManagedPage.id === 'canvas'
            ? `/api/documents/${encodeURIComponent(previewDocumentId)}/attachments`
            : ''
      : '';
  const previewTemplateSavedCallback =
    !canEditCurrentWorkspace
      ? undefined
      : selectedManagedPage.id === 'templates'
        ? () => setOwnerEventMessage('템플릿 생성 페이지의 onTemplateSaved 콜백이 실행되었습니다.')
        : selectedManagedPage.id === 'canvas' && settings.enableOnTemplateSaved
          ? (template: TemplateRecordDto) => setOwnerEventMessage(`onTemplateSaved 콜백: ${template.templateName} (${template.id})`)
          : undefined;
  const previewSaveDraftHtmlCallback =
    canEditCurrentWorkspace && documentSaveEnabled ? handleSaveDocumentDraft : undefined;
  const previewTodoPanelEnabled = usesTemplateList || Boolean(selectedDocumentInitialDraft);
  const previewTodoCount = previewTodoPanelEnabled ? documentRequestTasks.length : 0;
  const previewBaseWorkspaceProps: TemplateEditWorkspaceProps = resolveCanvasOwnerRouteWorkspaceProps({
    surface: selectedManagedPage.surface,
    props: {
      ...(usesTemplateList
        ? {
            initialTemplateId: selectedTemplateId,
            onTemplateSaved: previewTemplateSavedCallback,
          }
        : selectedDocumentInitialDraft
          ? {
              initialDraft: selectedDocumentInitialDraft,
              onSaveDraftHtml: previewSaveDraftHtmlCallback,
            }
          : {}),
      canvasOwnerAdditionalControlPanels: routeContractAdditionalControlPanels,
      canvasOwnerCanEditWorkspace: canEditCurrentWorkspace,
      canvasOwnerDocumentAttachmentApiPath: routeContractDocumentAttachmentApiPath,
      canvasOwnerRuntimeSaveDisabled: documentSaveEnabled && loadingDocumentDetail,
      canvasOwnerTodoButtonLabel: '할 일',
      canvasOwnerTodoCount: previewTodoCount,
      canvasOwnerTodoPanel: previewTodoPanelEnabled ? canvasTodoPanel : undefined,
      canvasOwnerTopNotice: routeContractTopNotice,
      documentAttachmentTagColorByName,
      documentAttachmentTagOptions,
      editableValueKeys: effectiveEditableValueKeys,
      onCanvasSelectionChange: handlePreviewCanvasSelectionChange,
      selectedCanvasBoxes: previewSelectedCanvasBoxes,
    },
  });
  const previewUiFeatureDiagnostics = resolveCanvasOwnerUiFeatureDiagnostics({
    settings: workspacePreviewSettings,
    baseProps: previewBaseWorkspaceProps,
  });
  const previewWorkspaceProps = applyCanvasOwnerSettingsToWorkspaceProps({
    baseProps: previewBaseWorkspaceProps,
    settings: workspacePreviewSettings,
    settingSources: workspacePreviewSettingSources,
  });
  const previewSettingDiagnostics = resolveCanvasOwnerSettingDiagnostics({
    settings: workspacePreviewSettings,
    settingSources: workspacePreviewSettingSources,
    baseProps: previewBaseWorkspaceProps,
    workspaceProps: previewWorkspaceProps,
  });
  const previewHideHeader = Boolean(previewWorkspaceProps.hideHeader);
  const previewHidePersistencePanel = Boolean(previewWorkspaceProps.hidePersistencePanel);
  const previewTemplateListDisplay = previewWorkspaceProps.templateListDisplay ?? workspacePreviewSettings.templateListDisplay;
  const previewEditableValueKeys = previewWorkspaceProps.editableValueKeys ?? null;
  const previewAdditionalControlPanels = previewWorkspaceProps.additionalControlPanels;
  const previewTopNotice = previewWorkspaceProps.topNotice;
  const previewShowWorkspaceMessages = previewWorkspaceProps.showWorkspaceMessages !== false;
  const previewSuppressInitialDraftLoadedMessage = Boolean(previewWorkspaceProps.suppressInitialDraftLoadedMessage);
  const previewHeaderTitle = previewWorkspaceProps.headerTitle ?? '상자 편집 캔버스';
  const previewHeaderDescription = previewWorkspaceProps.headerDescription ?? '공용 캔버스 owner 경로입니다.';
  const previewNameFieldLabel = previewWorkspaceProps.nameFieldLabel ?? '문서 이름:';
  const previewSaveButtonLabel = previewWorkspaceProps.saveButtonLabel ?? '문서 저장';
  const previewTemplateNameReadOnly = Boolean(previewWorkspaceProps.templateNameReadOnly);
  const previewSaveDisabled = Boolean(previewWorkspaceProps.saveDisabled);
  const previewCanvasPageContainerWidth = previewWorkspaceProps.canvasPageContainerWidth ?? '';
  const previewCanvasPageContainerHeight = previewWorkspaceProps.canvasPageContainerHeight ?? '';
  const previewCanvasSpecifiedHeightEnabled = Boolean(previewWorkspaceProps.canvasSpecifiedHeightEnabled);
  const previewCanvasSpecifiedHeight = previewWorkspaceProps.canvasSpecifiedHeight ?? '';
  const previewCanvasSpecifiedWidthEnabled = Boolean(previewWorkspaceProps.canvasSpecifiedWidthEnabled);
  const previewCanvasSpecifiedWidth = previewWorkspaceProps.canvasSpecifiedWidth ?? '';
  const previewDocumentAttachmentApiPath = previewWorkspaceProps.documentAttachmentApiPath ?? '';
  const previewInitialCanvasTab = previewWorkspaceProps.initialCanvasTab ?? workspacePreviewSettings.initialCanvasTab;
  const previewCanvasTextInteractionMode = previewWorkspaceProps.canvasTextInteractionMode ?? 'default';
  const previewCanvasSelectionMode = previewWorkspaceProps.canvasSelectionMode ?? 'none';
  const previewSelectionInactiveOverlayOpacity =
    previewWorkspaceProps.selectionInactiveOverlayOpacity ?? workspacePreviewSettings.selectionInactiveOverlayOpacity;
  const previewCanvasToolbarVisibility = previewWorkspaceProps.canvasToolbarVisibility ?? effectiveCanvasToolbarVisibility;
  const previewPersistenceVisibility = previewWorkspaceProps.persistenceVisibility ?? effectivePersistenceVisibility;
  const previewTemplateUsagePreviewLayoutDebugOptions =
    previewWorkspaceProps.templateUsagePreviewLayoutDebugOptions ?? templateUsagePreviewLayoutDebugOptions;
  const previewUsesRouteProps = 'central-route-contract + canvas-owner-settings';
  const previewAdditionalControlPanelsEnabled = Boolean(previewAdditionalControlPanels);
  const previewTopNoticeEnabled = Boolean(previewTopNotice);
  const previewUiFeatureDiagnosticByDefinitionName = new Map(
    previewUiFeatureDiagnostics.map((featureDiagnostic) => [featureDiagnostic.definitionName, featureDiagnostic])
  );
  const previewSettingDiagnosticBySettingKey = new Map(
    previewSettingDiagnostics.map((settingDiagnostic) => [settingDiagnostic.settingKey, settingDiagnostic])
  );
  const previewProblemSettingDiagnostics = previewSettingDiagnostics.filter(
    (settingDiagnostic) => settingDiagnostic.severity !== 'none'
  );
  const previewBlockingSettingDiagnosticCount = previewProblemSettingDiagnostics.filter(
    (settingDiagnostic) => settingDiagnostic.severity === 'blocking-risk'
  ).length;
  const previewWarningSettingDiagnosticCount = previewProblemSettingDiagnostics.filter(
    (settingDiagnostic) => settingDiagnostic.severity === 'warning'
  ).length;
  const settingKeyByDefinitionName: Record<string, CanvasOwnerSettingKey> = {
    hideHeader: 'hideHeader',
    hidePersistencePanel: 'hidePersistencePanel',
    showTopNotice: 'showTopNotice',
    showWorkspaceMessages: 'showWorkspaceMessages',
    showAdditionalControlPanels: 'showAdditionalControlPanels',
    'canvasToolbarVisibility.showCanvasTitle': 'showCanvasTitle',
    'canvasToolbarVisibility.showTemplateNameInput': 'showCanvasNameField',
    'canvasToolbarVisibility.showSaveButton': 'showCanvasSaveButton',
    'canvasToolbarVisibility.showTodoButton': 'showCanvasTodoButton',
    'canvasToolbarVisibility.showPreviewToggle': 'showCanvasPreviewToggle',
    'canvasToolbarVisibility.showInteractionToolControls': 'showCanvasInteractionToolControls',
    'canvasToolbarVisibility.showHistoryControls': 'showCanvasHistoryControls',
    'canvasToolbarVisibility.showZoomControls': 'showCanvasZoomControls',
    'canvasToolbarVisibility.showFullscreenControl': 'showCanvasFullscreenControl',
    defaultCanvasFullscreen: 'defaultCanvasFullscreen',
    pageContainerWidth: 'pageContainerWidth',
    pageContainerHeight: 'pageContainerHeight',
    autoCanvasHeight: 'autoCanvasHeight',
    autoCanvasWidth: 'autoCanvasWidth',
    specifiedCanvasHeight: 'specifiedCanvasHeight',
    specifiedCanvasWidth: 'specifiedCanvasWidth',
    'canvasToolbarVisibility.showEditSettingsToggle': 'showCanvasEditSettingsToggle',
    'canvasToolbarVisibility.showSelectionPanelTabs': 'showCanvasSelectionPanelTabs',
    initialCanvasTab: 'initialCanvasTab',
    'persistenceVisibility.showTemplateList': 'showPersistenceTemplateList',
    'persistenceVisibility.showTemplateNameInput': 'showPersistenceTemplateNameField',
    'persistenceVisibility.showLayoutResizePolicySelect': 'showPersistenceLayoutResizePolicyField',
    'persistenceVisibility.showSourceDocumentNameInput': 'showPersistenceSourceDocumentNameField',
    'persistenceVisibility.showSaveButton': 'showPersistenceSaveButton',
    suppressInitialDraftLoadedMessage: 'suppressInitialDraftLoadedMessage',
    stabilizeInitialLayout: 'stabilizeInitialLayout',
    enableRuntimeInitialAutoSize: 'enableRuntimeInitialAutoSize',
    preventInitialValueClearShrink: 'preventInitialValueClearShrink',
    blockPeerClusterHeightTargets: 'blockPeerClusterHeightTargets',
    blockPeerClusterWidthTargets: 'blockPeerClusterWidthTargets',
    selectionInactiveOverlayOpacity: 'selectionInactiveOverlayOpacity',
    allowCanvasBoxSelection: 'allowCanvasBoxSelection',
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
      : '기본';
  const getSettingDiagnosticForKey = (settingKey: CanvasOwnerSettingKey | null) =>
    settingKey ? previewSettingDiagnosticBySettingKey.get(settingKey) || null : null;
  const getSettingDiagnosticTone = (settingDiagnostic: CanvasOwnerSettingDiagnostic | null) => {
    if (!settingDiagnostic || settingDiagnostic.severity === 'none') {
      return 'none';
    }

    return settingDiagnostic.severity;
  };
  const getSettingPanelClassName = (settingKey: CanvasOwnerSettingKey | null) => {
    const diagnosticTone = getSettingDiagnosticTone(getSettingDiagnosticForKey(settingKey));

    if (diagnosticTone === 'blocking-risk') {
      return 'border-rose-200 bg-rose-50';
    }

    if (diagnosticTone === 'warning') {
      return 'border-amber-200 bg-amber-50';
    }

    if (diagnosticTone === 'info') {
      return 'border-blue-100 bg-blue-50';
    }

    return 'bg-white';
  };
  const getTextSettingClassName = (settingKey: CanvasOwnerSettingKey) =>
    `space-y-1 rounded border px-2 py-1 ${getSettingPanelClassName(settingKey)}`;
  const renderSettingSourceBadge = (settingKey: CanvasOwnerSettingKey) => (
    <span className="text-[9px] font-semibold text-slate-400">{getSettingSourceLabel(settingSources[settingKey])}</span>
  );
  const getSettingDiagnosticBadgeClassName = (severity: CanvasOwnerSettingDiagnostic['severity']) => {
    if (severity === 'blocking-risk') {
      return 'bg-rose-100 text-rose-700';
    }

    if (severity === 'warning') {
      return 'bg-amber-100 text-amber-700';
    }

    if (severity === 'info') {
      return 'bg-blue-100 text-blue-700';
    }

    return 'bg-slate-100 text-slate-500';
  };
  const getSettingDiagnosticLabel = (settingDiagnostic: CanvasOwnerSettingDiagnostic) => {
    if (settingDiagnostic.severity === 'blocking-risk') {
      return '위험';
    }

    if (settingDiagnostic.severity === 'warning') {
      return '알림';
    }

    if (settingDiagnostic.severity === 'info') {
      return '정보';
    }

    return '정상';
  };
  const renderSettingDiagnosticBadge = (settingKey: CanvasOwnerSettingKey) => {
    const settingDiagnostic = getSettingDiagnosticForKey(settingKey);

    if (!settingDiagnostic || settingDiagnostic.severity === 'none') {
      return null;
    }

    return (
      <span
        className={`rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${getSettingDiagnosticBadgeClassName(settingDiagnostic.severity)}`}
        title={`${settingDiagnostic.message} ${settingDiagnostic.recommendedAction}`}
      >
        {getSettingDiagnosticLabel(settingDiagnostic)}
      </span>
    );
  };
  const renderSettingBadges = (settingKey: CanvasOwnerSettingKey) => (
    <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1">
      {renderSettingDiagnosticBadge(settingKey)}
      {renderSettingSourceBadge(settingKey)}
    </span>
  );
  const getUiFeatureDiagnosticForDefinitionName = (definitionName: string) =>
    previewUiFeatureDiagnosticByDefinitionName.get(definitionName) || null;
  const getUiFeaturePanelClassName = (featureDiagnostic: CanvasOwnerUiFeatureDiagnostic | null) => {
    if (!featureDiagnostic) {
      return '';
    }

    if (featureDiagnostic.modeDiagnosticLevel === 'warning') {
      return 'bg-amber-50';
    }

    if (featureDiagnostic.actionAvailability === 'missing-runtime-condition') {
      return 'bg-slate-50';
    }

    return 'bg-white';
  };
  const getUiFeatureStatusItems = (
    featureDiagnostic: CanvasOwnerUiFeatureDiagnostic | null,
    settingDiagnostic?: CanvasOwnerSettingDiagnostic | null
  ): Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'muted' }> | undefined => {
    if (!featureDiagnostic) {
      return settingDiagnostic && settingDiagnostic.severity !== 'none'
        ? [
            {
              label: '설정 진단',
              value: settingDiagnostic.message,
              tone: settingDiagnostic.severity === 'info' ? 'default' : 'warning',
            },
          ]
        : undefined;
    }

    const statusItems: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'muted' }> = [
      {
        label: '설정',
        value: featureDiagnostic.configuredVisible ? 'ON' : 'OFF',
        tone: featureDiagnostic.configuredVisible ? 'success' : 'muted',
      },
      {
        label: '출력',
        value: featureDiagnostic.visible ? '출력' : '숨김',
        tone: featureDiagnostic.visible ? 'success' : 'muted',
      },
      {
        label: '모드',
        value:
          featureDiagnostic.modeDiagnosticLevel === 'warning'
            ? '알림'
            : featureDiagnostic.modeDiagnosticLevel === 'info'
              ? '정보'
              : '정상',
        tone:
          featureDiagnostic.modeDiagnosticLevel === 'warning'
            ? 'warning'
            : featureDiagnostic.modeDiagnosticLevel === 'info'
              ? 'default'
              : 'success',
      },
      {
        label: '실행 조건',
        value:
          featureDiagnostic.actionAvailability === 'missing-runtime-condition'
            ? '확인 필요'
            : featureDiagnostic.actionAvailability === 'available'
              ? '연결됨'
              : '해당 없음',
        tone:
          featureDiagnostic.actionAvailability === 'missing-runtime-condition'
            ? 'warning'
            : featureDiagnostic.actionAvailability === 'available'
              ? 'success'
              : 'muted',
      },
    ];

    if (featureDiagnostic.modeDiagnosticMessage) {
      statusItems.push({
        label: '알림',
        value: featureDiagnostic.modeDiagnosticMessage,
        tone: 'warning',
      });
    }

    if (featureDiagnostic.actionAvailabilityMessage) {
      statusItems.push({
        label: '조건',
        value: featureDiagnostic.actionAvailabilityMessage,
        tone: featureDiagnostic.actionAvailability === 'missing-runtime-condition' ? 'warning' : 'default',
      });
    }

    if (settingDiagnostic && settingDiagnostic.severity !== 'none') {
      statusItems.push({
        label:
          settingDiagnostic.severity === 'blocking-risk'
            ? '위험'
            : settingDiagnostic.severity === 'warning'
              ? '설정 알림'
              : '설정 정보',
        value: settingDiagnostic.message,
        tone: settingDiagnostic.severity === 'info' ? 'default' : 'warning',
      });
    }

    return statusItems;
  };
  const formatOptionalBooleanProp = (value: boolean | undefined) =>
    value === undefined ? 'not passed' : value ? 'true' : 'false';
  const displayEffectivePropName = (name: string) => {
    if (name === 'showInteractionModeControls') {
      return 'showInteractionToolControls';
    }

    if (name === 'showLayoutResizeModeSelect') {
      return 'showLayoutResizePolicySelect';
    }

    return name;
  };
  const createEffectivePropBooleanControl = (
    settingKey: CanvasOwnerSettingKey,
    trueValue: CanvasOwnerSettings[CanvasOwnerSettingKey] = true,
    falseValue: CanvasOwnerSettings[CanvasOwnerSettingKey] = false,
    trueLabel = 'true',
    falseLabel = 'false'
  ): EffectivePropBooleanControl => ({
    settingKey,
    trueValue,
    falseValue,
    trueLabel,
    falseLabel,
  });
  const createOptionalEffectivePropBooleanControl = (
    settingKey: CanvasOwnerSettingKey | undefined,
    trueValue: CanvasOwnerSettings[CanvasOwnerSettingKey] = true,
    falseValue: CanvasOwnerSettings[CanvasOwnerSettingKey] = false,
    trueLabel = 'true',
    falseLabel = 'false'
  ) =>
    settingKey
      ? createEffectivePropBooleanControl(settingKey, trueValue, falseValue, trueLabel, falseLabel)
      : undefined;
  const canvasToolbarVisibilitySettingKeys: Partial<Record<string, CanvasOwnerSettingKey>> = {
    showCanvasTitle: 'showCanvasTitle',
    showTemplateNameInput: 'showCanvasNameField',
    showSaveButton: 'showCanvasSaveButton',
    showTodoButton: 'showCanvasTodoButton',
    showPreviewToggle: 'showCanvasPreviewToggle',
    showInteractionModeControls: 'showCanvasInteractionToolControls',
    showHistoryControls: 'showCanvasHistoryControls',
    showZoomControls: 'showCanvasZoomControls',
    showFullscreenControl: 'showCanvasFullscreenControl',
    showEditSettingsToggle: 'showCanvasEditSettingsToggle',
    showSelectionPanelTabs: 'showCanvasSelectionPanelTabs',
  };
  const persistenceVisibilitySettingKeys: Partial<Record<string, CanvasOwnerSettingKey>> = {
    showTemplateList: 'showPersistenceTemplateList',
    showTemplateNameInput: 'showPersistenceTemplateNameField',
    showLayoutResizeModeSelect: 'showPersistenceLayoutResizePolicyField',
    showSourceDocumentNameInput: 'showPersistenceSourceDocumentNameField',
    showSaveButton: 'showPersistenceSaveButton',
  };
  const handleCanvasConfigRowCheckedChange = React.useCallback(
    (checked: boolean, settingKey?: string) => {
      if (!settingKey) {
        return;
      }

      updateSetting(
        settingKey as CanvasOwnerSettingKey,
        checked as CanvasOwnerSettings[CanvasOwnerSettingKey]
      );
    },
    [updateSetting]
  );
  const canvasConfigRows = [
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '워크스페이스 헤더 숨김',
      definitionName: 'hideHeader',
      description: '공용 캔버스 내부 제목과 설명 헤더를 렌더링하지 않습니다.',
      checked: settings.hideHeader,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '불러오기 및 저장 패널 숨김',
      definitionName: 'hidePersistencePanel',
      description: '템플릿 이름, 원본 문서명, 저장 버튼이 포함된 패널을 숨깁니다.',
      checked: settings.hidePersistencePanel,
      disabled: false,
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '상단 알림 표시',
      definitionName: 'showTopNotice',
      description: '외부에서 topNotice로 주입하는 상단 안내 영역을 표시합니다.',
      checked: settings.showTopNotice,
      disabled: false,
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '실행 알림 표시',
      definitionName: 'showWorkspaceMessages',
      description: 'setMessage(...)로 출력되는 상자 편집 캔버스 내부 실행 알림을 표시합니다. topNotice와는 별개입니다.',
      checked: settings.showWorkspaceMessages,
      disabled: false,
    },
    {
      sectionKey: 'workspaceFrame',
      sectionLabel: '공용 프레임',
      label: '추가 제어 패널',
      definitionName: 'showAdditionalControlPanels',
      description: '기본 툴바 외의 보조 제어 패널을 함께 표시합니다.',
      checked: settings.showAdditionalControlPanels,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '캔버스 제목 표시',
      definitionName: 'canvasToolbarVisibility.showCanvasTitle',
      description: '상자 편집 캔버스 카드 상단의 제목을 표시합니다.',
      checked: settings.showCanvasTitle,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '이름 입력 표시',
      definitionName: 'canvasToolbarVisibility.showTemplateNameInput',
      description: '캔버스 상단 이름 입력 영역을 표시합니다. 문서 출력/읽기 전용 페이지에서는 런타임 안전 정책에 따라 숨겨질 수 있습니다.',
      checked: settings.showCanvasNameField,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '상단 저장 버튼 표시',
      definitionName: 'canvasToolbarVisibility.showSaveButton',
      description: '캔버스 상단 저장 버튼을 표시합니다. 읽기 전용 페이지에서는 런타임 안전 정책에 따라 숨겨질 수 있습니다.',
      checked: settings.showCanvasSaveButton,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '할 일 버튼 표시',
      definitionName: 'canvasToolbarVisibility.showTodoButton',
      description: '템플릿/문서 화면에서 저장 버튼 오른쪽의 할 일 버튼을 표시합니다. 읽기 전용 페이지에서는 숨겨질 수 있습니다.',
      checked: settings.showCanvasTodoButton,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '미리보기 버튼 표시',
      definitionName: 'canvasToolbarVisibility.showPreviewToggle',
      description: '실제 사용 미리보기/편집 전환 버튼을 표시합니다. 현재 페이지 흐름과 맞지 않으면 알림만 표시합니다.',
      checked: settings.showCanvasPreviewToggle,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '선택/이동 표시',
      definitionName: 'canvasToolbarVisibility.showInteractionToolControls',
      description: '선택과 이동 전환 버튼을 표시합니다. 현재 페이지 흐름과 맞지 않으면 알림만 표시합니다.',
      checked: settings.showCanvasInteractionToolControls,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '실행 기록 표시',
      definitionName: 'canvasToolbarVisibility.showHistoryControls',
      description: '되돌리기와 다시 실행 버튼을 표시합니다.',
      checked: settings.showCanvasHistoryControls,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '확대/축소 표시',
      definitionName: 'canvasToolbarVisibility.showZoomControls',
      description: '문서 확대/축소 슬라이더와 버튼을 표시합니다.',
      checked: settings.showCanvasZoomControls,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '전체 화면 표시',
      definitionName: 'canvasToolbarVisibility.showFullscreenControl',
      description: '전체 화면 진입/종료 버튼을 표시합니다.',
      checked: settings.showCanvasFullscreenControl,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '초기 전체 화면',
      definitionName: 'defaultCanvasFullscreen',
      description: '상자 편집 캔버스를 처음 열 때 전체 화면 상태로 시작합니다.',
      checked: settings.defaultCanvasFullscreen,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '편집 설정 표시',
      definitionName: 'canvasToolbarVisibility.showEditSettingsToggle',
      description: '상자 편집 패널 열기/닫기 버튼을 표시합니다. 현재 페이지 흐름과 맞지 않으면 알림만 표시합니다.',
      checked: settings.showCanvasEditSettingsToggle,
      disabled: false,
    },
    {
      sectionKey: 'canvasEditor',
      sectionLabel: '상자 캔버스 편집',
      label: '편집 탭 표시',
      definitionName: 'canvasToolbarVisibility.showSelectionPanelTabs',
      description: '미리보기/크기 및 위치/속성/역할 탭 전환 버튼을 표시합니다. 현재 페이지 흐름과 맞지 않으면 알림만 표시합니다.',
      checked: settings.showCanvasSelectionPanelTabs,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '템플릿 목록 표시',
      definitionName: 'persistenceVisibility.showTemplateList',
      description: '불러오기 및 저장 안의 템플릿 선택 목록을 표시합니다.',
      checked: settings.showPersistenceTemplateList,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '템플릿 이름 표시',
      definitionName: 'persistenceVisibility.showTemplateNameInput',
      description: '불러오기 및 저장 안의 템플릿 이름 입력을 표시합니다.',
      checked: settings.showPersistenceTemplateNameField,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '레이아웃 정책 표시',
      definitionName: 'persistenceVisibility.showLayoutResizePolicySelect',
      description: '불러오기 및 저장 안의 레이아웃 확장 정책 선택을 표시합니다.',
      checked: settings.showPersistenceLayoutResizePolicyField,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '원본 문서명 표시',
      definitionName: 'persistenceVisibility.showSourceDocumentNameInput',
      description: '불러오기 및 저장 안의 원본 문서명 읽기 전용 필드를 표시합니다.',
      checked: settings.showPersistenceSourceDocumentNameField,
      disabled: false,
    },
    {
      sectionKey: 'persistencePanel',
      sectionLabel: '불러오기 및 저장',
      label: '하단 저장 버튼 표시',
      definitionName: 'persistenceVisibility.showSaveButton',
      description: '불러오기 및 저장 안의 전체 너비 저장 버튼을 표시합니다.',
      checked: settings.showPersistenceSaveButton,
      disabled: false,
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 초안 로드 안내 억제',
      definitionName: 'suppressInitialDraftLoadedMessage',
      description: '초기 draft 로드 완료 메시지를 사용자 알림으로 출력하지 않습니다.',
      checked: settings.suppressInitialDraftLoadedMessage,
      disabled: false,
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 레이아웃 안정화',
      definitionName: 'stabilizeInitialLayout',
      description: '미리보기 HTML 생성 직후 숨김 측정으로 자동 크기와 peer edge 배치를 먼저 확정합니다.',
      checked: settings.stabilizeInitialLayout,
      disabled: false,
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '런타임 초기 자동 크기',
      definitionName: 'enableRuntimeInitialAutoSize',
      description: '미리보기 런타임 연결 직후 자동 높이와 자동 너비 계산을 한 번 더 실행합니다.',
      checked: settings.enableRuntimeInitialAutoSize,
      disabled: false,
    },
    {
      sectionKey: 'initialLayout',
      sectionLabel: '초기 로드/레이아웃',
      label: '초기 value 제거 축소 방지',
      definitionName: 'preventInitialValueClearShrink',
      description: '미리보기 HTML 안정화 중 자동 크기 대상이 아닌 프레임이 예시 value 제거 영향으로 줄어드는 것을 막습니다. 자동 높이/너비 상자는 자체 규칙을 우선합니다.',
      checked: settings.preventInitialValueClearShrink,
      disabled: false,
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: 'peer cluster 높이 측정 차단',
      definitionName: 'blockPeerClusterHeightTargets',
      description: '자동 높이 측정 시 같은 peer cluster의 연동 높이 대상을 제외하고 현재 상자 기준으로 계산합니다.',
      checked: settings.blockPeerClusterHeightTargets,
      disabled: false,
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: 'peer cluster 너비 측정 차단',
      definitionName: 'blockPeerClusterWidthTargets',
      description: '자동 너비 측정 시 같은 peer cluster의 연동 너비 대상을 제외하고 현재 상자 기준으로 계산합니다.',
      checked: settings.blockPeerClusterWidthTargets,
      disabled: false,
    },
    {
      sectionKey: 'peerAutoSize',
      sectionLabel: 'Peer Edge/자동 크기',
      label: '런타임 자동 크기 축소 차단',
      definitionName: 'preventRuntimeAutoSizeShrink',
      description: '입력, 첨부, 서명 이후 자동 크기 재계산에서 음수 delta를 차단합니다. 기본 OFF가 자동 높이 축소/확장 정상 동작입니다.',
      checked: settings.preventRuntimeAutoSizeShrink,
      disabled: false,
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '이름 입력 읽기 전용',
      definitionName: 'templateNameReadOnly',
      description: '이름 입력 필드는 표시하되 사용자가 직접 수정할 수 없게 합니다.',
      checked: settings.templateNameReadOnly,
      disabled: false,
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '저장 비활성',
      definitionName: 'saveDisabled',
      description: '저장 버튼을 렌더링하지만 클릭할 수 없는 상태로 만듭니다.',
      checked: settings.saveDisabled,
      disabled: false,
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '첨부파일 API 연결',
      definitionName: 'enableDocumentAttachmentApiPath',
      description: '문서 출력 페이지에서 첨부파일 상자가 실제 문서 첨부 API를 사용하게 합니다.',
      checked: settings.enableDocumentAttachmentApiPath,
      disabled: false,
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '편집 가능 value 키 제한',
      definitionName: 'limitEditableValueKeys',
      description: '문서 출력 페이지에서 전달된 editableValueKeys에 포함된 value 상자만 수정할 수 있게 제한합니다.',
      checked: settings.limitEditableValueKeys,
      disabled: false,
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '저장 완료 콜백 연결',
      definitionName: 'onTemplateSaved',
      description: '템플릿 저장 성공 시 owner 페이지의 저장 후처리 콜백을 실행합니다.',
      checked: settings.enableOnTemplateSaved,
      disabled: false,
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
      description: '문서 출력 페이지에서 값 입력 제한과 첨부파일 API 연결 방식을 정합니다.',
    },
  ].map((section) => ({
    ...section,
    rows: canvasConfigRows.filter((row) => row.sectionKey === section.key),
  }));
  const effectiveTemplateWorkspacePropRows: EffectiveTemplateWorkspacePropRow[] = [
    {
      section: 'Page routing',
      name: 'page',
      value: selectedManagedPage.id,
      description: '공용 캔버스 환경설정을 소유하는 서비스 페이지입니다.',
    },
    {
      section: 'Page routing',
      name: 'route',
      value: selectedManagedPage.path,
      description: '선택한 페이지의 실제 라우트 또는 동적 라우트 패턴입니다.',
    },
    {
      section: 'Owner policy',
      name: 'surface',
      value: selectedManagedPage.surface,
      description: 'CanvasOwnedWorkspace가 허용 정책을 검증할 owner surface입니다.',
    },
    {
      section: 'Owner policy',
      name: 'canvasOwnerSettingsState',
      value: hasUnsavedCanvasSettings ? `${previewUsesRouteProps} (draft)` : previewUsesRouteProps,
      description: '서비스 페이지 기본 props 위에 현재 상자 편집 캔버스 환경설정을 적용한 effective 상태입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialTemplateId',
      value: usesTemplateList ? selectedTemplateId || '-' : '-',
      description: '템플릿 작성 페이지에서 최초로 불러올 템플릿 ID입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialDraft',
      value: selectedDocumentInitialDraft ? selectedDocumentInitialDraft.draftKey : 'null',
      description: '문서 출력 페이지에서 공용 캔버스에 주입되는 문서 초안입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'editableValueKeys',
      value: previewEditableValueKeys?.length ? previewEditableValueKeys.join(', ') : 'null',
      description: '문서 출력 페이지에서 수정 가능한 value 키 목록입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hideHeader',
      value: previewHideHeader ? 'true' : 'false',
      description: '공용 캔버스 내부 헤더 출력 여부를 제어합니다.',
      booleanControl: createEffectivePropBooleanControl('hideHeader'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hidePersistencePanel',
      value: previewHidePersistencePanel ? 'true' : 'false',
      description: '불러오기 및 저장 패널 출력 여부를 제어합니다.',
      booleanControl: createEffectivePropBooleanControl('hidePersistencePanel'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'templateListDisplay',
      value: usesTemplateList ? previewTemplateListDisplay : 'not passed',
      description: '템플릿 목록을 picker 또는 inline으로 출력합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'additionalControlPanels',
      value: previewAdditionalControlPanelsEnabled ? 'enabled' : 'disabled',
      description: '상위 표시 설정과 page의 추가 패널 전달이 모두 맞을 때 enabled가 됩니다.',
      booleanControl: createEffectivePropBooleanControl('showAdditionalControlPanels', true, false, 'enabled', 'disabled'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'topNotice',
      value: previewTopNoticeEnabled ? 'enabled' : 'disabled',
      description: '상위 표시 설정과 page의 topNotice 전달이 모두 맞을 때 enabled가 됩니다.',
      booleanControl: createEffectivePropBooleanControl('showTopNotice', true, false, 'enabled', 'disabled'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'showWorkspaceMessages',
      value: previewShowWorkspaceMessages ? 'true' : 'false',
      description: '상자 편집 캔버스 내부 실행 알림(message) 출력 여부입니다.',
      booleanControl: createEffectivePropBooleanControl('showWorkspaceMessages'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'suppressInitialDraftLoadedMessage',
      value: previewSuppressInitialDraftLoadedMessage ? 'true' : 'false',
      description: '초기 초안 로드 알림을 억제합니다.',
      booleanControl: createEffectivePropBooleanControl('suppressInitialDraftLoadedMessage'),
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
      booleanControl: createEffectivePropBooleanControl('templateNameReadOnly'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'saveDisabled',
      value: previewSaveDisabled ? 'true' : 'false',
      description: '저장 버튼의 실제 비활성 상태입니다.',
      booleanControl: createEffectivePropBooleanControl('saveDisabled'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'todoPanel',
      value: previewTodoPanelEnabled ? 'enabled' : 'disabled',
      description: '문서 출력 페이지에서 할 일 버튼을 누르면 출력되는 문서 요청 작업 패널입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'todoButtonLabel',
      value: previewTodoPanelEnabled ? '할 일' : 'not passed',
      description: '저장 버튼 오른쪽 할 일 버튼에 표시되는 문구입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'todoCount',
      value: String(previewTodoCount),
      description: '현재 문서에서 조회한 입력값, 서명, 사진, 파일 요청 작업 수입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'defaultCanvasFullscreen',
      value: previewWorkspaceProps.defaultCanvasFullscreen ? 'true' : 'false',
      description: '상자 편집 캔버스의 초기 전체 화면 활성 상태입니다.',
      booleanControl: createEffectivePropBooleanControl('defaultCanvasFullscreen'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'selectionInactiveOverlayOpacity',
      value: `${Math.round(previewSelectionInactiveOverlayOpacity * 100)}%`,
      description: '선택 중 비활성 상자 위에 덮는 오버레이 강도입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'allowCanvasBoxSelection',
      value: workspacePreviewSettings.allowCanvasBoxSelection ? 'true' : 'false',
      description: '읽기 전용 페이지에서 보기만 할지, 텍스트 상호작용 없이 상자 선택을 허용할지 정하는 owner 설정입니다.',
      booleanControl: createEffectivePropBooleanControl('allowCanvasBoxSelection'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasTextInteractionPolicy',
      value: previewCanvasTextInteractionMode,
      description: 'TemplateEditWorkspace에 전달되는 텍스트 포인터 상호작용 설정입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'canvasSelectionPolicy',
      value: previewCanvasSelectionMode,
      description: 'TemplateEditWorkspace에 전달되는 공용 상자 선택 설정입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialCanvasTab',
      value: previewInitialCanvasTab,
      description: '상자 편집 캔버스가 처음 열릴 때 선택할 내부 탭입니다.',
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
      booleanControl: createEffectivePropBooleanControl('autoCanvasHeight', false, true),
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
      booleanControl: createEffectivePropBooleanControl('autoCanvasWidth', false, true),
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
      description: '문서 출력 페이지 첨부파일 API 경로입니다.',
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
        canEditCurrentWorkspace &&
        usesTemplateList &&
        (selectedManagedPage.id === 'templates' || (selectedManagedPage.id === 'canvas' && settings.enableOnTemplateSaved))
          ? 'enabled'
          : 'disabled',
      description: '상위 콜백 연결 설정과 page의 저장 콜백 전달이 모두 맞을 때 enabled가 됩니다.',
      booleanControl: createEffectivePropBooleanControl('enableOnTemplateSaved', true, false, 'enabled', 'disabled'),
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'onSaveDraftHtml',
      value: canEditCurrentWorkspace && documentSaveEnabled ? 'enabled' : 'disabled',
      description: '문서 출력 페이지 저장 콜백 연결 여부입니다. 저장 비활성 설정은 이 콜백 사용 가능 상태와 별도로 진단합니다.',
    },
    ...(previewCanvasToolbarVisibility ? Object.entries(previewCanvasToolbarVisibility) : []).map(([name, value]) => ({
      section: 'canvasToolbarVisibility',
      name: displayEffectivePropName(name),
      value: value ? 'true' : 'false',
      description: '상자 캔버스 편집 영역의 항목별 실제 표시 여부입니다.',
      booleanControl: createOptionalEffectivePropBooleanControl(canvasToolbarVisibilitySettingKeys[name]),
    })),
    ...(previewPersistenceVisibility ? Object.entries(previewPersistenceVisibility) : []).map(([name, value]) => ({
      section: 'persistenceVisibility',
      name: displayEffectivePropName(name),
      value: value ? 'true' : 'false',
      description: '불러오기 및 저장 패널의 항목별 실제 표시 여부입니다.',
      booleanControl: createOptionalEffectivePropBooleanControl(persistenceVisibilitySettingKeys[name]),
    })),
    ...previewUiFeatureDiagnostics.flatMap((featureDiagnostic) => [
      {
        section: 'uiFeatureState',
        name: `${featureDiagnostic.key}.configuredVisible`,
        value: featureDiagnostic.configuredVisible ? 'true' : 'false',
        description: `${featureDiagnostic.label}: 환경 설정에서 선택한 표시/기능 값입니다.`,
        booleanControl: createEffectivePropBooleanControl(featureDiagnostic.settingKey),
      },
      {
        section: 'uiFeatureState',
        name: `${featureDiagnostic.key}.visible`,
        value: featureDiagnostic.visible ? 'true' : 'false',
        description: `${featureDiagnostic.label}: 모드 진단과 무관하게 설정값만 반영한 실제 출력 상태입니다.`,
        booleanControl: createEffectivePropBooleanControl(featureDiagnostic.settingKey),
      },
      {
        section: 'uiFeatureState',
        name: `${featureDiagnostic.key}.modeDiagnosticLevel`,
        value: featureDiagnostic.modeDiagnosticLevel,
        description: featureDiagnostic.modeDiagnosticMessage || `${featureDiagnostic.label}: 모드 진단 알림이 없습니다.`,
      },
      {
        section: 'uiFeatureState',
        name: `${featureDiagnostic.key}.actionAvailability`,
        value: featureDiagnostic.actionAvailability,
        description:
          featureDiagnostic.actionAvailabilityMessage ||
          `${featureDiagnostic.label}: 별도 실행 조건 진단이 없습니다.`,
      },
    ]),
    ...(previewProblemSettingDiagnostics.length
      ? previewProblemSettingDiagnostics.flatMap((settingDiagnostic) => [
          {
            section: 'settingDiagnostics',
            name: `${settingDiagnostic.settingKey}.severity`,
            value: settingDiagnostic.severity,
            description: `${settingDiagnostic.label}: ${settingDiagnostic.category}`,
          },
          {
            section: 'settingDiagnostics',
            name: `${settingDiagnostic.settingKey}.message`,
            value: settingDiagnostic.message,
            description: settingDiagnostic.recommendedAction,
          },
        ])
      : [
          {
            section: 'settingDiagnostics',
            name: 'checkedSettings',
            value: `${previewSettingDiagnostics.length} checked`,
            description: '현재 선택한 page 조건에서 설정 충돌이 감지되지 않았습니다.',
          },
        ]),
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'stabilizeInitialLayout',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.stabilizeInitialLayout),
      description: '미리보기 HTML 생성 직후 숨김 측정으로 자동 크기와 peer edge 배치를 확정합니다.',
      booleanControl: createEffectivePropBooleanControl('stabilizeInitialLayout'),
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'enableInitialAutoSize',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.enableInitialAutoSize),
      description: '런타임 연결 직후 자동 크기 계산을 한 번 더 실행합니다.',
      booleanControl: createEffectivePropBooleanControl('enableRuntimeInitialAutoSize'),
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventInitialValueClearShrink',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.preventInitialValueClearShrink),
      description: '자동 크기 대상이 아닌 프레임의 미리보기 진입 1회성 축소만 차단합니다.',
      booleanControl: createEffectivePropBooleanControl('preventInitialValueClearShrink'),
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventRuntimeAutoSizeShrink',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.preventRuntimeAutoSizeShrink),
      description: '입력/첨부/서명 이후 런타임 자동 크기 축소를 차단합니다. 기본 OFF입니다.',
      booleanControl: createEffectivePropBooleanControl('preventRuntimeAutoSizeShrink'),
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterHeightTargets',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.measurePeerClusterHeightTargets),
      description: '자동 높이 측정에서 peer cluster 높이 대상을 포함합니다.',
      booleanControl: createEffectivePropBooleanControl('blockPeerClusterHeightTargets', false, true),
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterWidthTargets',
      value: formatOptionalBooleanProp(previewTemplateUsagePreviewLayoutDebugOptions?.measurePeerClusterWidthTargets),
      description: '자동 너비 측정에서 peer cluster 너비 대상을 포함합니다.',
      booleanControl: createEffectivePropBooleanControl('blockPeerClusterWidthTargets', false, true),
    },
  ];
  const effectiveTemplateWorkspacePropSections = [
    {
      key: 'pageRouting',
      sourceSection: 'Page routing',
      label: '페이지',
      definitionName: 'managedCanvasPage',
      description: '공용 캔버스를 사용하는 서비스 페이지입니다.',
    },
    {
      key: 'ownerPolicy',
      sourceSection: 'Owner policy',
      label: 'Owner 정책',
      definitionName: 'Owner policy',
      description: 'CanvasOwnedWorkspace가 공용 캔버스 사용 경로를 검증하는 값입니다.',
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
    {
      key: 'uiFeatureState',
      sourceSection: 'uiFeatureState',
      label: 'UI 기능 진단 상태',
      definitionName: 'resolvedUiFeatureDiagnostics',
      description: '환경 설정값을 실제 출력 기준으로 두고, 모드 불일치와 실행 조건은 알림으로만 보여줍니다.',
    },
    {
      key: 'settingDiagnostics',
      sourceSection: 'settingDiagnostics',
      label: '설정 충돌 진단',
      definitionName: 'resolvedSettingDiagnostics',
      description: '환경 설정값은 그대로 두고, page 모드와 런타임 조건 충돌만 표시합니다.',
    },
  ].map((section) => ({
    ...section,
    rows: effectiveTemplateWorkspacePropRows.filter((row) => row.section === section.sourceSection),
  }));
  const renderManagedPageControls = () => (
    <OwnerSettingsManagedTargetControls
      value={selectedManagedPage.id}
      targets={managedCanvasPages.map((page) => ({
        value: page.id,
        label: page.label,
        path: page.path,
        description: page.description,
        badge: (
          <Badge variant="slate" className="shrink-0 px-2 py-0 text-[10px]">
            {page.surface}
          </Badge>
        ),
        detailRows: [
          { label: 'route', value: page.path },
          { label: 'surface', value: page.surface },
        ],
      }))}
      onChange={(nextValue) => handleSelectManagedPage(nextValue as ManagedCanvasPageId)}
    />
  );
  const renderPageSettingsImportSection = () => (
    <div className="space-y-3">
      <OwnerSettingsSectionHeader
        label="이 페이지의 캔버스 환경설정"
        description="설정은 페이지가 소유합니다. 다른 페이지 설정이 필요하면 불러와 복사합니다."
      />
      <div
        className="space-y-2 rounded-md border border-slate-200 px-3 py-2"
        {...canvasOwnerItem('canvas-page-settings-import-container', '설정 불러오기 영역')}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-800" {...canvasOwnerItem('canvas-page-settings-import-title', '설정 불러오기 제목')}>설정 불러오기</div>
          <p className="text-[10px] leading-4 text-slate-500" {...canvasOwnerItem('canvas-page-settings-import-description', '설정 불러오기 설명')}>
            다른 페이지의 현재 설정을 이 페이지로 복사합니다. 불러온 뒤에는 서로 연결되지 않습니다.
          </p>
        </div>
        <EntityPicker
          value={settingsImportSourcePageId}
          options={settingsImportOptions}
          onChange={handleSelectSettingsImportSource}
          placeholder="불러올 페이지 설정 선택"
          searchPlaceholder="페이지 이름이나 경로 검색"
          optionLayout="stacked"
          ownerItemKey="canvas-page-settings-import-picker"
          ownerItemName="설정 불러오기 선택기"
          ownerItemAttributes={canvasOwnerItem}
        />
      </div>
    </div>
  );
  const renderCanvasSizeSettings = () => (
    <div className="space-y-1.5">
      <OwnerSettingsSectionHeader
        label="출력 크기"
        description="자동 크기를 끄면 상자 편집 캔버스 출력 크기를 직접 지정합니다."
      />
      <div className="grid gap-2 lg:grid-cols-2">
        <div
          className={`space-y-2 rounded border px-2 py-1.5 ${getSettingPanelClassName('autoCanvasHeight')}`}
          {...canvasOwnerEnv('autoCanvasHeight')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>자동 높이</span>
                {renderSettingBadges('autoCanvasHeight')}
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
            <div className={getTextSettingClassName('specifiedCanvasHeight')} {...canvasOwnerEnv('specifiedCanvasHeight')}>
              <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
                <span>높이 값</span>
                {renderSettingBadges('specifiedCanvasHeight')}
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
        <div
          className={`space-y-2 rounded border px-2 py-1.5 ${getSettingPanelClassName('autoCanvasWidth')}`}
          {...canvasOwnerEnv('autoCanvasWidth')}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>자동 너비</span>
                {renderSettingBadges('autoCanvasWidth')}
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
            <div className={getTextSettingClassName('specifiedCanvasWidth')} {...canvasOwnerEnv('specifiedCanvasWidth')}>
              <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
                <span>너비 값</span>
                {renderSettingBadges('specifiedCanvasWidth')}
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
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={getTextSettingClassName('pageContainerWidth')} {...canvasOwnerEnv('pageContainerWidth')}>
          <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
            <span>페이지 컨테이너 폭</span>
            {renderSettingBadges('pageContainerWidth')}
          </label>
          <Input
            className={compactInputClassName}
            placeholder="예: 100%, 1280px, min(100%, 1800px)"
            value={settings.pageContainerWidth}
            onChange={(event) => updateSetting('pageContainerWidth', event.target.value)}
          />
        </div>
        <div className={getTextSettingClassName('pageContainerHeight')} {...canvasOwnerEnv('pageContainerHeight')}>
          <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
            <span>페이지 컨테이너 높이</span>
            {renderSettingBadges('pageContainerHeight')}
          </label>
          <Input
            className={compactInputClassName}
            placeholder="비워두면 기본 높이 정책 사용"
            value={settings.pageContainerHeight}
            onChange={(event) => updateSetting('pageContainerHeight', event.target.value)}
          />
        </div>
      </div>
    </div>
  );
  const renderCanvasSelectionOverlaySettings = () => {
    const overlayOpacityPercent = Math.round(settings.selectionInactiveOverlayOpacity * 100);
    const updateOverlayOpacity = (value: string) => {
      const numericValue = Number(value);
      const nextPercent = Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : 50;

      updateSetting('selectionInactiveOverlayOpacity', nextPercent / 100);
    };

    return (
      <div className="space-y-1.5">
        <OwnerSettingsSectionHeader
          label="선택 오버레이"
          description="선택 중 비활성 상자를 덮는 흰색 오버레이 강도입니다."
        />
        <div
          className={`space-y-2 rounded border px-2 py-1.5 ${getSettingPanelClassName('selectionInactiveOverlayOpacity')}`}
          {...canvasOwnerEnv('selectionInactiveOverlayOpacity')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>비활성 상자 오버레이 강도</span>
                {renderSettingBadges('selectionInactiveOverlayOpacity')}
              </div>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                0%는 오버레이 없음, 100%는 비활성 상자를 흰색으로 완전히 덮습니다.
              </p>
            </div>
            <Badge variant="slate" className="shrink-0 px-2 py-0 text-[10px]">
              {overlayOpacityPercent}%
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_84px]">
            <Input
              type="range"
              min="0"
              max="100"
              step="5"
              value={String(overlayOpacityPercent)}
              onChange={(event) => updateOverlayOpacity(event.target.value)}
              className="h-8 px-0"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={overlayOpacityPercent}
              onChange={(event) => updateOverlayOpacity(event.target.value)}
              className={compactInputClassName}
            />
          </div>
        </div>
        <div
          className={`space-y-2 rounded border px-2 py-1.5 ${getSettingPanelClassName('allowCanvasBoxSelection')}`}
          {...canvasOwnerEnv('allowCanvasBoxSelection')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                <span>읽기 출력 상자 선택 허용</span>
                {renderSettingBadges('allowCanvasBoxSelection')}
              </div>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                ON이면 텍스트 상호작용 대신 상자 선택 정책을 사용하고, OFF이면 보기 전용 기본 정책을 사용합니다.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={settings.allowCanvasBoxSelection ? 'default' : 'outline'}
              className="h-7 shrink-0 px-2 text-[11px]"
              onClick={() => updateSetting('allowCanvasBoxSelection', !settings.allowCanvasBoxSelection)}
            >
              {settings.allowCanvasBoxSelection ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>
      </div>
    );
  };
  const renderCanvasTextSettings = () => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <div className={getTextSettingClassName('headerTitle')} {...canvasOwnerEnv('headerTitle')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>headerTitle</span>
          {renderSettingBadges('headerTitle')}
        </label>
        <Input className={compactInputClassName} value={settings.headerTitle} onChange={(event) => updateSetting('headerTitle', event.target.value)} />
      </div>
      <div className={getTextSettingClassName('headerDescription')} {...canvasOwnerEnv('headerDescription')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>headerDescription</span>
          {renderSettingBadges('headerDescription')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.headerDescription}
          onChange={(event) => updateSetting('headerDescription', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('nameFieldLabel')} {...canvasOwnerEnv('nameFieldLabel')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>nameFieldLabel</span>
          {renderSettingBadges('nameFieldLabel')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.nameFieldLabel}
          onChange={(event) => updateSetting('nameFieldLabel', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('saveButtonLabel')} {...canvasOwnerEnv('saveButtonLabel')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>saveButtonLabel</span>
          {renderSettingBadges('saveButtonLabel')}
        </label>
        <Input
          className={compactInputClassName}
          value={settings.saveButtonLabel}
          onChange={(event) => updateSetting('saveButtonLabel', event.target.value)}
        />
      </div>
      <div className={getTextSettingClassName('templateListDisplay')} {...canvasOwnerEnv('templateListDisplay')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>templateListDisplay</span>
          {renderSettingBadges('templateListDisplay')}
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
      <div className={getTextSettingClassName('initialCanvasTab')} {...canvasOwnerEnv('initialCanvasTab')}>
        <label className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
          <span>initialCanvasTab</span>
          {renderSettingBadges('initialCanvasTab')}
        </label>
        <OptionButtonGroup
          value={settings.initialCanvasTab}
          onChange={(value) => updateSetting('initialCanvasTab', value as CanvasOwnerSettings['initialCanvasTab'])}
          options={[
            { value: 'preview', label: '미리보기' },
            { value: 'position', label: '크기 및 위치' },
            { value: 'metadata', label: '속성' },
            { value: 'metadata2', label: '역할' },
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
            <OwnerSettingsSectionHeader
              label={section.label}
              description={section.description}
              count={`${section.rows.length}개`}
            />
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {section.rows.map((row) => {
                const settingKey = getSettingKeyForDefinitionName(row.definitionName);
                const featureDiagnostic = getUiFeatureDiagnosticForDefinitionName(row.definitionName);
                const settingDiagnostic = getSettingDiagnosticForKey(settingKey);

                return (
                  <SettingToggleRow
                    key={row.definitionName}
                    label={row.label}
                    sectionLabel={row.sectionLabel}
                    definitionName={`${row.definitionName}${settingKey ? ` · ${getSettingSourceLabel(settingSources[settingKey])}` : ''}`}
                    settingKey={settingKey || undefined}
                    env={row.definitionName}
                    description={row.description}
                    statusItems={getUiFeatureStatusItems(featureDiagnostic, settingDiagnostic)}
                    checked={row.checked}
                    disabled={row.disabled}
                    className={`${getSettingPanelClassName(settingKey)} ${getUiFeaturePanelClassName(featureDiagnostic)}`}
                    onCheckedChange={handleCanvasConfigRowCheckedChange}
                  />
                );
              })}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
  const renderSettingConflictDiagnostics = () => (
    <div className="space-y-1.5" {...canvasOwnerItem('setting-conflict-diagnostics', '설정 충돌 진단')}>
      <OwnerSettingsSectionHeader
        label="설정 충돌 진단"
        description="환경설정 값은 그대로 두고 현재 page 조건에서 문제가 되는 충돌만 표시합니다."
        count={`${previewProblemSettingDiagnostics.length}개 / ${previewSettingDiagnostics.length}개 점검`}
        badge={
          <span className="flex items-center gap-1">
            {previewBlockingSettingDiagnosticCount > 0 ? (
              <Badge variant="red" className="px-2 py-0 text-[10px]">
                위험 {previewBlockingSettingDiagnosticCount}
              </Badge>
            ) : null}
            {previewWarningSettingDiagnosticCount > 0 ? (
              <Badge variant="amber" className="px-2 py-0 text-[10px]">
                알림 {previewWarningSettingDiagnosticCount}
              </Badge>
            ) : null}
          </span>
        }
      />
      {previewProblemSettingDiagnostics.length > 0 ? (
        <div className="grid gap-1 md:grid-cols-2">
          {previewProblemSettingDiagnostics.map((settingDiagnostic) => {
            const diagnosticFixLabel = settingDiagnostic.fixes.map((fix) => fix.label).join(' · ');
            const diagnosticCardClassName = `min-w-0 rounded border px-2 py-1.5 text-left text-[11px] transition-colors ${
              settingDiagnostic.severity === 'blocking-risk'
                ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                : settingDiagnostic.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100'
            } ${settingDiagnostic.fixes.length > 0 ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500' : ''}`;
            const diagnosticCardContent = (
              <>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0 truncate font-semibold">
                    {settingDiagnostic.label}
                  </div>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${getSettingDiagnosticBadgeClassName(settingDiagnostic.severity)}`}
                  >
                    {getSettingDiagnosticLabel(settingDiagnostic)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] font-semibold" title={settingDiagnostic.definitionName}>
                  {settingDiagnostic.definitionName}
                </div>
                <p className="mt-1 text-[10px] leading-4">
                  {settingDiagnostic.message}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 opacity-80">
                  {settingDiagnostic.recommendedAction}
                </p>
                {diagnosticFixLabel ? (
                  <div className="mt-1 truncate rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold" title={diagnosticFixLabel}>
                    클릭 적용: {diagnosticFixLabel}
                  </div>
                ) : null}
                <div className="mt-1 grid gap-1 text-[9px] font-semibold opacity-80 sm:grid-cols-2">
                  <div className="truncate" title={settingDiagnostic.configuredValue}>
                    설정 {settingDiagnostic.configuredValue}
                  </div>
                  <div className="truncate" title={settingDiagnostic.effectiveValue}>
                    적용 {settingDiagnostic.effectiveValue}
                  </div>
                </div>
              </>
            );

            return settingDiagnostic.fixes.length > 0 ? (
              <button
                key={`${settingDiagnostic.settingKey}:${settingDiagnostic.severity}`}
                type="button"
                className={diagnosticCardClassName}
                title={diagnosticFixLabel}
                onClick={() => applySettingDiagnosticFix(settingDiagnostic)}
                {...canvasOwnerEnv(settingDiagnostic.definitionName)}
              >
                {diagnosticCardContent}
              </button>
            ) : (
              <div
                key={`${settingDiagnostic.settingKey}:${settingDiagnostic.severity}`}
                className={diagnosticCardClassName}
                {...canvasOwnerEnv(settingDiagnostic.definitionName)}
              >
                {diagnosticCardContent}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700">
          현재 선택한 page 조건에서 설정 충돌이 감지되지 않았습니다.
        </div>
      )}
    </div>
  );
  const renderEffectivePropValue = (row: EffectiveTemplateWorkspacePropRow) => {
    const booleanControl = row.booleanControl;

    if (!booleanControl) {
      return (
        <div className="mt-0.5 truncate text-[10px] font-semibold leading-[11px] text-blue-700" title={row.value}>
          {row.value}
        </div>
      );
    }

    const trueLabel = booleanControl.trueLabel || 'true';
    const falseLabel = booleanControl.falseLabel || 'false';
    const valueOptions = [
      {
        label: trueLabel,
        value: booleanControl.trueValue,
        active: row.value === trueLabel,
      },
      {
        label: falseLabel,
        value: booleanControl.falseValue,
        active: row.value === falseLabel,
      },
    ];

    return (
      <div className="mt-0.5 flex min-w-0 flex-wrap gap-1" title={`${row.name}: ${row.value}`}>
        {valueOptions.map((option) => (
          <button
            key={`${row.section}:${row.name}:${option.label}`}
            type="button"
            className={`h-5 min-w-[44px] rounded border px-1 text-[10px] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${
              option.active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
            }`}
            aria-pressed={option.active}
            onClick={() => applyEffectivePropBooleanControl(booleanControl, option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  };
  const renderEffectiveTemplateWorkspaceProps = () => (
    <div className="space-y-1.5">
      <OwnerSettingsSectionHeader
        label="전달 prop 전체"
        description="CanvasOwnedWorkspace를 거쳐 TemplateEditWorkspace에 실제로 전달되는 effective 값입니다."
        count={`${effectiveTemplateWorkspacePropRows.length}개`}
      />
      {effectiveTemplateWorkspacePropSections.map((section) =>
        section.rows.length > 0 ? (
          <div key={section.key} className="space-y-1">
            <OwnerSettingsSectionHeader
              label={section.label}
              description={`${section.definitionName} · ${section.description}`}
              count={`${section.rows.length}개`}
            />
            <div className="grid gap-1 md:grid-cols-2 2xl:grid-cols-3">
              {section.rows.map((row) => (
                <div key={`${row.section}:${row.name}`} className="min-w-0 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700">
                  <div className="flex min-w-0 items-center gap-1 leading-3">
                    <span className="min-w-0 truncate font-semibold text-slate-800">{row.name}</span>
                  </div>
                  {renderEffectivePropValue(row)}
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
    <main
      ref={canvasOwnerRootRef}
      className="min-h-screen bg-white"
      data-canvas-owner-auto-name-root="canvas-page"
      {...canvasOwnerItem('canvas-page-root', '상자 편집 캔버스 페이지 루트')}
    >
      <div
        className="mx-auto flex w-full min-w-0 max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6"
        {...canvasOwnerItem('canvas-page-shell', '상자 편집 캔버스 페이지 본문')}
      >
        <header className="min-w-0 max-w-full space-y-3">
          <Badge variant="blue">CANVAS-OWNER-01</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-950">상자 편집 캔버스</h1>
            <p className="max-w-4xl text-sm text-slate-600">
              모든 문서 출력의 기준이 되는 owner 페이지입니다. 이 화면에서 페이지별 환경설정 적용 결과와 공용 캔버스 출력을 직접 확인합니다.
            </p>
          </div>
        </header>

        {message ? (
          <Card className="min-w-0 max-w-full border-slate-200 bg-slate-50">
            <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
          </Card>
        ) : null}

        {ownerEventMessage ? (
          <Card className="min-w-0 max-w-full border-slate-200 bg-slate-50">
            <CardContent className="p-4 text-sm text-slate-700">{ownerEventMessage}</CardContent>
          </Card>
        ) : null}

        {selectedManagedPage.id === 'templates' ? null : extractStatusNotice}

        <div
          className="grid min-w-0 max-w-full gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]"
          {...canvasOwnerItem('canvas-page-main-grid', '상자 편집 캔버스 페이지 주요 영역')}
        >
          <Card className="min-w-0 max-w-full border-slate-200" {...canvasOwnerItem('canvas-management-panel', '공용 캔버스 관리 패널')}>
            <CardHeader className="space-y-1 p-4 pb-3" {...canvasOwnerItem('canvas-management-panel-header', '공용 캔버스 관리 패널 머리글')}>
              <CardTitle className="text-sm" {...canvasOwnerItem('canvas-management-panel-title', '공용 캔버스 관리 패널 제목')}>공용 캔버스 관리</CardTitle>
              <CardDescription className="text-xs leading-5" {...canvasOwnerItem('canvas-management-panel-description', '공용 캔버스 관리 패널 설명')}>
                공용 캔버스를 쓰는 페이지를 선택하고, 페이지별 환경설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0" {...canvasOwnerItem('canvas-management-panel-content', '공용 캔버스 관리 패널 내용')}>
              {renderManagedPageControls()}
            </CardContent>
          </Card>

          {usesTemplateList ? (
            <Card className="min-w-0 max-w-full border-slate-200" {...canvasOwnerItem('current-template-panel', '현재 템플릿 상태 패널')}>
              <CardHeader className="space-y-1 p-4 pb-3" {...canvasOwnerItem('current-template-panel-header', '현재 템플릿 상태 패널 머리글')}>
                <CardTitle className="text-sm" {...canvasOwnerItem('current-template-panel-title', '현재 템플릿 상태 패널 제목')}>현재 템플릿</CardTitle>
                <CardDescription className="text-xs leading-5" {...canvasOwnerItem('current-template-panel-description', '현재 템플릿 상태 패널 설명')}>템플릿 선택 상태를 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm text-slate-700" {...canvasOwnerItem('current-template-panel-content', '현재 템플릿 상태 패널 내용')}>
                <div className="grid min-w-0 max-w-full gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-xs sm:grid-cols-[72px_minmax(0,1fr)]" {...canvasOwnerItem('current-template-summary-grid', '현재 템플릿 요약 표')}>
                  <div className="font-medium text-slate-700" {...canvasOwnerItem('current-template-name-label', '현재 템플릿 이름 라벨')}>이름</div>
                  <div className="truncate text-slate-900" {...canvasOwnerItem('current-template-name-value', '현재 템플릿 이름 값')}>{selectedTemplateSummary?.templateName || '아직 선택되지 않음'}</div>
                  <div className="font-medium text-slate-700" {...canvasOwnerItem('current-template-id-label', '현재 템플릿 ID 라벨')}>ID</div>
                  <div className="truncate text-slate-500" {...canvasOwnerItem('current-template-id-value', '현재 템플릿 ID 값')}>{selectedTemplateSummary?.id || '-'}</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="min-w-0 max-w-full border-slate-200" {...canvasOwnerItem('document-picker-panel', '문서 선택 상태 패널')}>
              <CardHeader className="space-y-1 p-4 pb-3" {...canvasOwnerItem('document-picker-panel-header', '문서 선택 상태 패널 머리글')}>
                <CardTitle className="text-sm" {...canvasOwnerItem('document-picker-panel-title', '문서 선택 상태 패널 제목')}>문서 선택</CardTitle>
                <CardDescription className="text-xs leading-5" {...canvasOwnerItem('document-picker-panel-description', '문서 선택 상태 패널 설명')}>문서 선택 상태와 public prop 설정을 함께 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0" {...canvasOwnerItem('document-picker-panel-content', '문서 선택 상태 패널 내용')}>
                <EntityPicker
                  value={selectedDocumentId}
                  options={documentOptions}
                  onChange={(value) => updateQuery({ documentId: value })}
                  placeholder="문서를 고르세요"
                  searchPlaceholder="문서 검색"
                  optionLayout="stacked"
                  disabled={loadingLists}
                  ownerItemKey="document-picker"
                  ownerItemName="문서 선택기"
                  ownerItemAttributes={canvasOwnerItem}
                />

                {selectedDocumentDetail ? (
                  <div className="grid min-w-0 max-w-full gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-xs sm:grid-cols-[88px_minmax(0,1fr)]" {...canvasOwnerItem('document-picker-detail-grid', '문서 선택 상세 요약 표')}>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-title-label', '문서 선택 문서명 라벨')}>문서명</div>
                    <div className="truncate text-slate-900" {...canvasOwnerItem('document-picker-detail-title-value', '문서 선택 문서명 값')}>{selectedDocumentDetail.document.title}</div>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-id-label', '문서 선택 문서 ID 라벨')}>문서 ID</div>
                    <div className="truncate text-slate-500" {...canvasOwnerItem('document-picker-detail-id-value', '문서 선택 문서 ID 값')}>{selectedDocumentDetail.document.id}</div>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-version-label', '문서 선택 현재 버전 라벨')}>현재 버전</div>
                    <div className="truncate text-slate-700" {...canvasOwnerItem('document-picker-detail-version-value', '문서 선택 현재 버전 값')}>{selectedDocumentDetail.latestVersion?.versionNumber || '-'}</div>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-saved-at-label', '문서 선택 마지막 저장 라벨')}>마지막 저장</div>
                    <div className="truncate text-slate-700" {...canvasOwnerItem('document-picker-detail-saved-at-value', '문서 선택 마지막 저장 값')}>{formatDateTime(selectedDocumentDetail.latestVersion?.createdAt)}</div>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-template-label', '문서 선택 연결 템플릿 라벨')}>연결 템플릿</div>
                    <div className="truncate text-slate-700" {...canvasOwnerItem('document-picker-detail-template-value', '문서 선택 연결 템플릿 값')}>{selectedDocumentDetail.linkedTemplate?.templateName || '-'}</div>
                    <div className="font-medium text-slate-700" {...canvasOwnerItem('document-picker-detail-editable-keys-label', '문서 선택 editable 키 라벨')}>editable 키</div>
                    <div className="truncate text-slate-700" {...canvasOwnerItem('document-picker-detail-editable-keys-value', '문서 선택 editable 키 값')}>
                      editableValueKeys 샘플:{' '}
                      {editableValueKeyCandidates.length ? editableValueKeyCandidates.join(', ') : '문서 값 키 없음'}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500" {...canvasOwnerItem('document-picker-empty-state', '문서 선택 상태 빈 상태')}>
                    {loadingDocumentDetail ? '문서 상세를 불러오는 중입니다.' : '문서를 선택하면 여기에서 현재 상태를 확인합니다.'}
                  </p>
                )}

              </CardContent>
            </Card>
          )}

	          <Card className="min-w-0 max-w-full border-slate-200 xl:col-span-2">
	            <CardHeader className="p-4 pb-3">
                <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
	                    <CardTitle className="text-sm">상자 편집 캔버스 환경설정</CardTitle>
	                    <CardDescription className="text-xs leading-5">
	                      {`${selectedManagedPage.label} 페이지 설정을 편집합니다. 설정은 페이지 단위로만 저장됩니다.`}
	                    </CardDescription>
                  </div>
                  <OwnerSettingsActionBar
                    dirty={hasUnsavedCanvasSettings}
                    onReset={resetCanvasOwnerSettings}
                    onSave={saveCanvasOwnerSettings}
                  />
                </div>
		            </CardHeader>
		            <CardContent className="min-w-0 max-w-full space-y-3 p-4 pt-0">
			              {renderPageSettingsImportSection()}
			              {renderCanvasSizeSettings()}
			              {renderCanvasSelectionOverlaySettings()}
			              {renderCanvasTextSettings()}
			              {renderCanvasConfigSections()}
		              {renderSettingConflictDiagnostics()}
		              {renderEffectiveTemplateWorkspaceProps()}
	            </CardContent>
	          </Card>

	          <div className="min-w-0 max-w-full space-y-3 xl:col-span-2">
	            <Divider
                label={`공용 캔버스 · ${selectedManagedPage.label}`}
                className="py-0"
              />
              {usesTemplateList ? (
                <CanvasOwnedWorkspace
                  key={`canvas-owner:${selectedManagedPage.id}:${selectedTemplateId || 'no-template'}`}
                  surface={selectedManagedPage.surface}
                  applyStoredCanvasOwnerSettings={false}
                  canvasOwnerSettings={workspacePreviewSettings}
                  canvasOwnerSettingSources={workspacePreviewSettingSources}
                  initialTemplateId={selectedTemplateId}
                  canvasOwnerAdditionalControlPanels={routeContractAdditionalControlPanels}
                  canvasOwnerCanEditWorkspace={canEditCurrentWorkspace}
                  canvasOwnerDocumentAttachmentApiPath={routeContractDocumentAttachmentApiPath}
                  canvasOwnerRuntimeSaveDisabled={documentSaveEnabled && loadingDocumentDetail}
                  canvasOwnerTodoButtonLabel="할 일"
                  canvasOwnerTodoCount={documentRequestTasks.length}
                  canvasOwnerTodoPanel={canvasTodoPanel}
                  canvasOwnerTopNotice={routeContractTopNotice}
                  documentAttachmentTagOptions={documentAttachmentTagOptions}
                  documentAttachmentTagColorByName={documentAttachmentTagColorByName}
                  selectedCanvasBoxes={previewSelectedCanvasBoxes}
                  onCanvasSelectionChange={handlePreviewCanvasSelectionChange}
                  onTemplateSaved={previewTemplateSavedCallback}
                />
              ) : selectedDocumentInitialDraft ? (
                <CanvasOwnedWorkspace
                  key={`canvas-owner:${selectedManagedPage.id}:${selectedDocumentInitialDraft.draftKey}`}
                  surface={selectedManagedPage.surface}
                  applyStoredCanvasOwnerSettings={false}
                  canvasOwnerSettings={workspacePreviewSettings}
                  canvasOwnerSettingSources={workspacePreviewSettingSources}
                  initialDraft={selectedDocumentInitialDraft}
                  editableValueKeys={previewBaseWorkspaceProps.editableValueKeys}
                  canvasOwnerAdditionalControlPanels={routeContractAdditionalControlPanels}
                  canvasOwnerCanEditWorkspace={canEditCurrentWorkspace}
                  canvasOwnerDocumentAttachmentApiPath={routeContractDocumentAttachmentApiPath}
                  canvasOwnerRuntimeSaveDisabled={documentSaveEnabled && loadingDocumentDetail}
                  canvasOwnerTodoButtonLabel="할 일"
                  canvasOwnerTodoCount={documentRequestTasks.length}
                  canvasOwnerTodoPanel={canvasTodoPanel}
                  canvasOwnerTopNotice={routeContractTopNotice}
                  documentAttachmentTagOptions={documentAttachmentTagOptions}
                  documentAttachmentTagColorByName={documentAttachmentTagColorByName}
                  selectedCanvasBoxes={previewSelectedCanvasBoxes}
                  onCanvasSelectionChange={handlePreviewCanvasSelectionChange}
                  onSaveDraftHtml={previewSaveDraftHtmlCallback}
                />
            ) : (
              <div className="px-6 py-12 text-sm text-slate-500">
                {loadingDocumentDetail ? '문서 초안을 준비하는 중입니다.' : '문서를 선택하면 공용 캔버스가 여기에 표시됩니다.'}
              </div>
            )}
          </div>

          <div className="min-w-0 max-w-full xl:col-span-2">
            <MemoOwnerSharedUiPreview
              ownerLabel={`공용 캔버스 · ${selectedManagedPage.label}`}
              itemAttributes={canvasOwnerItem}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
