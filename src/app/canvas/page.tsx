'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type TemplateEditWorkspaceInitialDraft } from '../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../components/template/workspace/types';
import { CanvasOwnedWorkspace } from './ownerPolicy';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Divider } from '../../components/ui/Divider';
import { EntityPicker, type EntityPickerOption } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import { OptionButtonGroup } from '../../components/ui/OptionButtonGroup';
import { SettingToggleRow } from '../../components/ui/SettingToggleRow';
import type { DocumentDetailResult, DocumentListItem } from '../../lib/documentDtos';
import { buildDocumentAttachmentTextByValueKey, groupDocumentValueFilesByValueKey } from '../../lib/documentAttachmentValues';
import type { TemplateRecordDto } from '../../lib/templateDtos';

type CanvasWorkspaceMode = 'template' | 'document' | 'read';

const normalizeCanvasWorkspaceMode = (value: string | null | undefined): CanvasWorkspaceMode => {
  if (value === 'document' || value === 'read') {
    return value;
  }

  return 'template';
};

const fetchSuccessData = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || '데이터 조회에 실패했습니다.');
  }

  return result.data as T;
};

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const stringifyDocumentValue = (value: unknown) => {
  if (typeof value === 'string') {
    return collapseWhitespace(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return collapseWhitespace(JSON.stringify(value));
};

const stringifyAttachmentDocumentValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return collapseWhitespace(JSON.stringify(value));
};

const isValueFieldElement = (element: Element) =>
  element.matches('[data-template-frame-role="value"]') ||
  element.closest('[data-template-frame-role="value"]') !== null ||
  element.matches('[data-template-usage-preview-value-box="true"]') ||
  element.closest('[data-template-usage-preview-value-box="true"]') !== null;

const isAttachmentValueElement = (element: Element) =>
  element.matches('[data-template-box-kind="attachment"], [data-template-runtime-mode="file_slot"]') ||
  element.closest('[data-template-box-kind="attachment"], [data-template-runtime-mode="file_slot"]') !== null;

const resolveDocumentValueKey = (element: Element) => {
  const currentElementKey =
    element.getAttribute('data-template-frame-value-key')?.trim() ||
    element.getAttribute('data-label')?.trim() ||
    '';

  if (currentElementKey) {
    return currentElementKey;
  }

  const owner =
    element.closest<HTMLElement>('[data-template-frame-value-key]') ||
    element.closest<HTMLElement>('[data-label]') ||
    null;

  if (!owner) {
    return '';
  }

  return owner.getAttribute('data-template-frame-value-key')?.trim() || owner.getAttribute('data-label')?.trim() || '';
};

const readDocumentValueEntryValue = (entry: NonNullable<DocumentDetailResult['valueEntries']>[number]) => {
  if (entry.valuePayload && typeof entry.valuePayload === 'object' && 'value' in entry.valuePayload) {
    return entry.valuePayload.value;
  }

  return entry.displayText;
};

const setDocumentValueElement = (element: HTMLElement, value: string) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
    element.defaultValue = value;
    element.setAttribute('value', value);

    if (element instanceof HTMLTextAreaElement) {
      element.textContent = value;
    }

    if (!value) {
      element.removeAttribute('placeholder');
    }

    return;
  }

  if (element.querySelector('[data-template-frame-input="true"]')) {
    return;
  }

  element.textContent = value;

  if (!value) {
    element.removeAttribute('data-placeholder');
  }
};

const materializeDocumentHtmlWithLabelValues = (htmlCanonical: string, labelValues: Record<string, unknown>) => {
  if (!htmlCanonical.trim() || typeof document === 'undefined') {
    return htmlCanonical;
  }

  const container = document.createElement('div');
  container.innerHTML = htmlCanonical;
  container
    .querySelectorAll<HTMLElement>('[data-template-frame-input="true"], [data-label], [data-template-frame-value-key]')
    .forEach((element) => {
      if (!isValueFieldElement(element)) {
        return;
      }

      const valueKey = resolveDocumentValueKey(element);

      if (!valueKey) {
        return;
      }

      setDocumentValueElement(
        element,
        isAttachmentValueElement(element)
          ? stringifyAttachmentDocumentValue(labelValues[valueKey])
          : stringifyDocumentValue(labelValues[valueKey])
      );
    });

  return container.innerHTML.trim();
};

const extractDocumentLabelValuesFromHtml = (htmlCanonical: string, fallbackValues: Record<string, unknown>) => {
  if (!htmlCanonical.trim() || typeof document === 'undefined') {
    return fallbackValues;
  }

  const container = document.createElement('div');
  container.innerHTML = htmlCanonical;
  const nextValues = { ...fallbackValues };

  container
    .querySelectorAll<HTMLElement>('[data-template-frame-input="true"], [data-label], [data-template-frame-value-key]')
    .forEach((element) => {
      if (!isValueFieldElement(element)) {
        return;
      }

      const valueKey = resolveDocumentValueKey(element);

      if (!valueKey) {
        return;
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        nextValues[valueKey] = isAttachmentValueElement(element)
          ? String(element.value || '').trim()
          : collapseWhitespace(element.value || '');
        return;
      }

      nextValues[valueKey] = isAttachmentValueElement(element)
        ? String(element.textContent || '').trim()
        : collapseWhitespace(element.textContent || '');
    });

  return nextValues;
};

const isLaterOrSameDateTime = (left: string | null | undefined, right: string | null | undefined) => {
  if (!left || !right) {
    return Boolean(left) && !right;
  }

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return false;
  }

  return leftTime >= rightTime;
};

const resolvePreferredDocumentHtml = (params: {
  linkedRenderHtml?: string | null;
  lastSyncedAt?: string | null;
  latestVersionHtml?: string | null;
  latestVersionCreatedAt?: string | null;
}) => {
  const linkedRenderHtml = params.linkedRenderHtml?.trim() || '';
  const latestVersionHtml = params.latestVersionHtml?.trim() || '';

  if (linkedRenderHtml && isLaterOrSameDateTime(params.lastSyncedAt, params.latestVersionCreatedAt)) {
    return linkedRenderHtml;
  }

  if (latestVersionHtml) {
    return latestVersionHtml;
  }

  return linkedRenderHtml;
};

const materializeDocumentHtml = (params: {
  linkedRenderHtml?: string | null;
  lastSyncedAt?: string | null;
  latestVersionHtml?: string | null;
  latestVersionCreatedAt?: string | null;
  labelValues: Record<string, unknown>;
}) => {
  const preferredHtml = resolvePreferredDocumentHtml(params);

  if (!preferredHtml.trim()) {
    return '';
  }

  return materializeDocumentHtmlWithLabelValues(preferredHtml, params.labelValues);
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

const compactInputClassName = 'h-8 px-2 text-xs';

type CanvasOwnerSettings = {
  hideHeader: boolean;
  hidePersistencePanel: boolean;
  templateListDisplay: 'picker' | 'inline';
  showTopNotice: boolean;
  showAdditionalControlPanels: boolean;
  suppressInitialDraftLoadedMessage: boolean;
  headerTitle: string;
  headerDescription: string;
  nameFieldLabel: string;
  saveButtonLabel: string;
  templateNameReadOnly: boolean;
  saveDisabled: boolean;
  enableDocumentAttachmentApiPath: boolean;
  limitEditableValueKeys: boolean;
  enableOnTemplateSaved: boolean;
};

const defaultCanvasOwnerSettings: CanvasOwnerSettings = {
  hideHeader: true,
  hidePersistencePanel: false,
  templateListDisplay: 'picker',
  showTopNotice: false,
  showAdditionalControlPanels: false,
  suppressInitialDraftLoadedMessage: true,
  headerTitle: '상자 편집 캔버스',
  headerDescription: '공용 캔버스 owner 경로입니다.',
  nameFieldLabel: '문서 이름:',
  saveButtonLabel: '문서 저장',
  templateNameReadOnly: true,
  saveDisabled: false,
  enableDocumentAttachmentApiPath: true,
  limitEditableValueKeys: false,
  enableOnTemplateSaved: true,
};

export default function CanvasOwnerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceMode = normalizeCanvasWorkspaceMode(searchParams.get('mode'));
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';
  const documentIdFromQuery = searchParams.get('documentId')?.trim() || '';

  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [loadingLists, setLoadingLists] = React.useState(false);
  const [loadingDocumentDetail, setLoadingDocumentDetail] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [ownerEventMessage, setOwnerEventMessage] = React.useState<string | null>(null);
  const [draftReloadNonce, setDraftReloadNonce] = React.useState(0);
  const [settings, setSettings] = React.useState<CanvasOwnerSettings>(defaultCanvasOwnerSettings);

  const selectedTemplateId = templateIdFromQuery || templates[0]?.id || '';
  const selectedDocumentId = documentIdFromQuery || documents[0]?.document.id || '';

  const updateSetting = React.useCallback(
    <K extends keyof CanvasOwnerSettings>(key: K, value: CanvasOwnerSettings[K]) => {
      setSettings((previous) => ({
        ...previous,
        [key]: value,
      }));
    },
    []
  );

  const updateQuery = React.useCallback(
    (patch: Partial<Record<'mode' | 'templateId' | 'documentId', string>>) => {
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
    if (workspaceMode === 'template' || !selectedDocumentId) {
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
  }, [selectedDocumentId, workspaceMode]);

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

    const nextValues = {
      ...(selectedDocumentDetail.latestVersion?.labelValues || {}),
      ...buildDocumentAttachmentTextByValueKey(selectedDocumentDetail.valueFiles || []),
    } as Record<string, unknown>;

    selectedDocumentDetail.valueEntries.forEach((entry) => {
      nextValues[entry.valueKey] = readDocumentValueEntryValue(entry);
    });

    return nextValues;
  }, [selectedDocumentDetail]);

  const selectedDocumentInitialDraft = React.useMemo<TemplateEditWorkspaceInitialDraft | null>(() => {
    if (!selectedDocumentDetail) {
      return null;
    }

    const draftHtml = materializeDocumentHtml({
      linkedRenderHtml: selectedDocumentDetail.linkedTemplate?.renderSnapshotHtml,
      lastSyncedAt: selectedDocumentDetail.templateLink?.lastSyncedAt || null,
      latestVersionHtml: selectedDocumentDetail.latestVersion?.htmlCanonical,
      latestVersionCreatedAt: selectedDocumentDetail.latestVersion?.createdAt,
      labelValues: selectedDocumentLabelValues,
    });

    if (!draftHtml.trim()) {
      return null;
    }

    return {
      draftKey: `canvas:${workspaceMode}:${selectedDocumentDetail.document.id}:${selectedDocumentDetail.latestVersion?.id || 'no-version'}:${draftReloadNonce}`,
      templateName: selectedDocumentDetail.document.title,
      draftHtml,
      sourceDocumentName: '',
      layoutResizeMode: 'grow_height',
      attachmentFilesByValueKey,
    };
  }, [attachmentFilesByValueKey, draftReloadNonce, selectedDocumentDetail, selectedDocumentLabelValues, workspaceMode]);

  const handleSaveDocumentDraft = React.useCallback(
    async ({ currentHtml, attachmentDrafts }: TemplateEditWorkspaceSaveDraftParams) => {
      if (!selectedDocumentDetail?.document.id) {
        throw new Error('문서를 먼저 선택해 주세요.');
      }

      const nextLabelValues = extractDocumentLabelValuesFromHtml(currentHtml, selectedDocumentLabelValues);
      const nextValueFiles = await buildDocumentAttachmentValueFilesForSave({
        attachmentApiPath: `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/attachments`,
        attachmentDrafts,
      });

      const response = await fetch(`/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: currentHtml,
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
  const effectiveHeaderTitle = settings.headerTitle.trim() || '상자 편집 캔버스';
  const effectiveHeaderDescription = settings.headerDescription.trim() || '공용 캔버스 owner 경로입니다.';
  const effectiveNameFieldLabel = settings.nameFieldLabel.trim() || '문서 이름:';
  const effectiveSaveButtonLabel = settings.saveButtonLabel.trim() || '문서 저장';
  const editableValueKeyCandidates = React.useMemo(
    () => Object.keys(selectedDocumentLabelValues).filter((key) => String(key || '').trim().length > 0).slice(0, 3),
    [selectedDocumentLabelValues]
  );
  const effectiveEditableValueKeys =
    workspaceMode === 'template' || !settings.limitEditableValueKeys ? null : editableValueKeyCandidates;
  const topNotice = settings.showTopNotice ? (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      owner page sample `topNotice`가 켜진 상태입니다. 현재 모드: {workspaceMode}
    </div>
  ) : null;
  const additionalControlPanels = settings.showAdditionalControlPanels ? (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="font-medium text-slate-900">additionalControlPanels 샘플</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        TemplatePersistencePanel 위에 외부 제어 패널을 삽입하는 public prop 상태를 여기서 확인합니다.
      </p>
    </div>
  ) : undefined;
  const effectiveDocumentAttachmentApiPath =
    settings.enableDocumentAttachmentApiPath && selectedDocumentDetail
      ? `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/attachments`
      : '';
  const effectiveSaveDisabled =
    workspaceMode === 'read' ? true : settings.saveDisabled || (workspaceMode === 'document' && loadingDocumentDetail);
  const canvasConfigRows = [
    {
      label: '헤더 숨김',
      checked: settings.hideHeader,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('hideHeader', checked),
    },
    {
      label: '불러오기 및 저장 숨김',
      checked: settings.hidePersistencePanel,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('hidePersistencePanel', checked),
    },
    {
      label: 'topNotice 표시',
      checked: settings.showTopNotice,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showTopNotice', checked),
    },
    {
      label: '추가 제어 패널',
      checked: settings.showAdditionalControlPanels,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showAdditionalControlPanels', checked),
    },
    {
      label: '초기 draft 안내 억제',
      checked: settings.suppressInitialDraftLoadedMessage,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('suppressInitialDraftLoadedMessage', checked),
    },
    {
      label: '이름 읽기 전용',
      checked: settings.templateNameReadOnly,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('templateNameReadOnly', checked),
    },
    {
      label: '저장 비활성',
      checked: settings.saveDisabled,
      disabled: workspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('saveDisabled', checked),
    },
    {
      label: '첨부파일 API 연결',
      checked: settings.enableDocumentAttachmentApiPath,
      disabled: workspaceMode === 'template',
      onCheckedChange: (checked: boolean) => updateSetting('enableDocumentAttachmentApiPath', checked),
    },
    {
      label: 'editableValueKeys 제한',
      checked: settings.limitEditableValueKeys,
      disabled: workspaceMode === 'template' || editableValueKeyCandidates.length === 0,
      onCheckedChange: (checked: boolean) => updateSetting('limitEditableValueKeys', checked),
    },
    {
      label: 'onTemplateSaved 콜백',
      checked: settings.enableOnTemplateSaved,
      disabled: workspaceMode !== 'template',
      onCheckedChange: (checked: boolean) => updateSetting('enableOnTemplateSaved', checked),
    },
  ];

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

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="border-slate-200">
            <CardHeader className="space-y-1 p-4 pb-3">
              <CardTitle className="text-sm">모드</CardTitle>
              <CardDescription className="text-xs leading-5">같은 공용 캔버스를 어떤 환경으로 여는지 선택합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 p-4 pt-0">
              <div className="grid gap-2">
                {(['template', 'document', 'read'] as CanvasWorkspaceMode[]).map((mode) => {
                  const active = workspaceMode === mode;
                  return (
                    <Button
                      key={mode}
                      variant={active ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => updateQuery({ mode })}
                    >
                      {mode === 'template' ? '템플릿 모드' : mode === 'document' ? '문서 모드' : '읽기 모드'}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-slate-500">{modeDescriptions[workspaceMode]}</p>
            </CardContent>
          </Card>

          {workspaceMode === 'template' ? (
            <Card className="border-slate-200">
              <CardHeader className="space-y-1 p-4 pb-3">
                <CardTitle className="text-sm">현재 템플릿</CardTitle>
                <CardDescription className="text-xs leading-5">템플릿 선택 상태와 public prop 설정을 함께 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm text-slate-700">
                <div className="grid gap-x-3 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-xs sm:grid-cols-[72px_minmax(0,1fr)]">
                  <div className="font-medium text-slate-700">이름</div>
                  <div className="truncate text-slate-900">{selectedTemplateSummary?.templateName || '아직 선택되지 않음'}</div>
                  <div className="font-medium text-slate-700">ID</div>
                  <div className="truncate text-slate-500">{selectedTemplateSummary?.id || '-'}</div>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">headerTitle</label>
                      <Input className={compactInputClassName} value={settings.headerTitle} onChange={(event) => updateSetting('headerTitle', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">headerDescription</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.headerDescription}
                        onChange={(event) => updateSetting('headerDescription', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">nameFieldLabel</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.nameFieldLabel}
                        onChange={(event) => updateSetting('nameFieldLabel', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">saveButtonLabel</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.saveButtonLabel}
                        onChange={(event) => updateSetting('saveButtonLabel', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">templateListDisplay</label>
                      <OptionButtonGroup
                        value={settings.templateListDisplay}
                        onChange={(value) => updateSetting('templateListDisplay', value)}
                        options={[
                          { value: 'picker', label: 'picker' },
                          { value: 'inline', label: 'inline' },
                        ]}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">초안 다시 적용</label>
                      <Button type="button" variant="outline" className="h-8 w-full px-2 text-[11px]" onClick={() => setDraftReloadNonce((previous) => previous + 1)}>
                        draftKey 새로 만들기
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {canvasConfigRows.map((row) => (
                      <SettingToggleRow
                        key={row.label}
                        label={row.label}
                        checked={row.checked}
                        disabled={row.disabled}
                        onCheckedChange={row.onCheckedChange}
                      />
                    ))}
                  </div>
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

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">headerTitle</label>
                      <Input className={compactInputClassName} value={settings.headerTitle} onChange={(event) => updateSetting('headerTitle', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">headerDescription</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.headerDescription}
                        onChange={(event) => updateSetting('headerDescription', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">nameFieldLabel</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.nameFieldLabel}
                        onChange={(event) => updateSetting('nameFieldLabel', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">saveButtonLabel</label>
                      <Input
                        className={compactInputClassName}
                        value={settings.saveButtonLabel}
                        onChange={(event) => updateSetting('saveButtonLabel', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-slate-700">초안 다시 적용</label>
                      <Button type="button" variant="outline" className="h-8 w-full px-2 text-[11px]" onClick={() => setDraftReloadNonce((previous) => previous + 1)}>
                        draftKey 새로 만들기
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    {canvasConfigRows.map((row) => (
                      <SettingToggleRow
                        key={row.label}
                        label={row.label}
                        checked={row.checked}
                        disabled={row.disabled}
                        onCheckedChange={row.onCheckedChange}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3 xl:col-span-2">
            <Divider label="공용 캔버스" className="py-0" />
            {workspaceMode === 'template' ? (
              <CanvasOwnedWorkspace
                surface="canvas"
                initialTemplateId={selectedTemplateId}
                templateListDisplay={settings.templateListDisplay}
                hideHeader={settings.hideHeader}
                hidePersistencePanel={settings.hidePersistencePanel}
                additionalControlPanels={additionalControlPanels}
                topNotice={topNotice}
                suppressInitialDraftLoadedMessage={settings.suppressInitialDraftLoadedMessage}
                headerTitle={effectiveHeaderTitle}
                headerDescription={effectiveHeaderDescription}
                nameFieldLabel={effectiveNameFieldLabel}
                saveButtonLabel={effectiveSaveButtonLabel}
                templateNameReadOnly={settings.templateNameReadOnly}
                saveDisabled={effectiveSaveDisabled}
                onTemplateSaved={
                  settings.enableOnTemplateSaved
                    ? (template) => setOwnerEventMessage(`onTemplateSaved 콜백: ${template.templateName} (${template.id})`)
                    : undefined
                }
              />
            ) : selectedDocumentInitialDraft ? (
              <CanvasOwnedWorkspace
                surface="canvas"
                initialDraft={selectedDocumentInitialDraft}
                workspaceMode={workspaceMode}
                editableValueKeys={effectiveEditableValueKeys}
                hideHeader={settings.hideHeader}
                hidePersistencePanel={settings.hidePersistencePanel}
                additionalControlPanels={additionalControlPanels}
                topNotice={topNotice}
                suppressInitialDraftLoadedMessage={settings.suppressInitialDraftLoadedMessage}
                headerTitle={effectiveHeaderTitle}
                headerDescription={effectiveHeaderDescription}
                nameFieldLabel={effectiveNameFieldLabel}
                saveButtonLabel={effectiveSaveButtonLabel}
                templateNameReadOnly={settings.templateNameReadOnly}
                saveDisabled={effectiveSaveDisabled}
                documentAttachmentApiPath={effectiveDocumentAttachmentApiPath}
                onSaveDraftHtml={workspaceMode === 'document' ? handleSaveDocumentDraft : undefined}
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
