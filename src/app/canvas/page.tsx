'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  materializeTemplateCanvasHtmlForPersistence,
  type TemplateEditWorkspaceInitialDraft,
} from '../../components/template/TemplateEditWorkspace';
import { buildDocumentAttachmentValueFilesForSave } from '../../components/template/workspace/persistence/documentAttachmentClient';
import type { TemplateEditWorkspaceSaveDraftParams } from '../../components/template/workspace/types';
import {
  TemplateExtractWorkspace,
  type TemplateExtractWorkspaceStatus,
} from '../../components/template/TemplateExtractWorkspace';
import { CanvasOwnedWorkspace } from './ownerPolicy';
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
  stabilizeInitialLayout: boolean;
  enableRuntimeInitialAutoSize: boolean;
  preventInitialValueClearShrink: boolean;
  preventRuntimeAutoSizeShrink: boolean;
  blockPeerClusterHeightTargets: boolean;
  blockPeerClusterWidthTargets: boolean;
};

const defaultCanvasOwnerSettings: CanvasOwnerSettings = {
  hideHeader: true,
  hidePersistencePanel: false,
  templateListDisplay: 'inline',
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
  stabilizeInitialLayout: true,
  enableRuntimeInitialAutoSize: true,
  preventInitialValueClearShrink: true,
  preventRuntimeAutoSizeShrink: false,
  blockPeerClusterHeightTargets: false,
  blockPeerClusterWidthTargets: false,
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
  const [extractStatus, setExtractStatus] = React.useState<TemplateExtractWorkspaceStatus | null>(null);
  const [extractStatusResetKey, setExtractStatusResetKey] = React.useState(0);
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
      draftKey: `canvas:${workspaceMode}:${selectedDocumentDetail.document.id}:${selectedDocumentDetail.latestVersion?.id || 'no-version'}:${buildDocumentHtmlContentKey(draftHtml)}:${draftReloadNonce}`,
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
  const templateExtractPanel =
    workspaceMode === 'template' ? (
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
      {settings.showAdditionalControlPanels ? (
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
    settings.enableDocumentAttachmentApiPath && selectedDocumentDetail
      ? `/api/documents/${encodeURIComponent(selectedDocumentDetail.document.id)}/attachments`
      : '';
  const effectiveSaveDisabled =
    workspaceMode === 'read' ? true : settings.saveDisabled || (workspaceMode === 'document' && loadingDocumentDetail);
  const templateUsagePreviewLayoutDebugOptions = React.useMemo(
    () => ({
      stabilizeInitialLayout: settings.stabilizeInitialLayout,
      enableInitialAutoSize: settings.enableRuntimeInitialAutoSize,
      preventInitialValueClearShrink: settings.preventInitialValueClearShrink,
      preventRuntimeAutoSizeShrink: settings.preventRuntimeAutoSizeShrink,
      measurePeerClusterHeightTargets: !settings.blockPeerClusterHeightTargets,
      measurePeerClusterWidthTargets: !settings.blockPeerClusterWidthTargets,
    }),
    [
      settings.blockPeerClusterHeightTargets,
      settings.blockPeerClusterWidthTargets,
      settings.enableRuntimeInitialAutoSize,
      settings.preventInitialValueClearShrink,
      settings.preventRuntimeAutoSizeShrink,
      settings.stabilizeInitialLayout,
    ]
  );
  const canvasConfigRows = [
    {
      sectionKey: 'display',
      sectionLabel: '표시 영역',
      label: '워크스페이스 헤더 숨김',
      definitionName: 'hideHeader',
      description: '공용 캔버스 내부 제목과 설명 헤더를 렌더링하지 않습니다.',
      checked: settings.hideHeader,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('hideHeader', checked),
    },
    {
      sectionKey: 'display',
      sectionLabel: '표시 영역',
      label: '불러오기 및 저장 패널 숨김',
      definitionName: 'hidePersistencePanel',
      description: '템플릿 이름, 원본 문서명, 저장 버튼이 포함된 패널을 숨깁니다.',
      checked: settings.hidePersistencePanel,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('hidePersistencePanel', checked),
    },
    {
      sectionKey: 'display',
      sectionLabel: '표시 영역',
      label: '상단 알림 표시',
      definitionName: 'showTopNotice',
      description: '공용 워크스페이스 상단의 안내 또는 실행 알림 영역을 표시합니다.',
      checked: settings.showTopNotice,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showTopNotice', checked),
    },
    {
      sectionKey: 'display',
      sectionLabel: '표시 영역',
      label: '추가 제어 패널',
      definitionName: 'showAdditionalControlPanels',
      description: '기본 툴바 외의 보조 제어 패널을 함께 표시합니다.',
      checked: settings.showAdditionalControlPanels,
      disabled: false,
      onCheckedChange: (checked: boolean) => updateSetting('showAdditionalControlPanels', checked),
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
      disabled: workspaceMode === 'read',
      onCheckedChange: (checked: boolean) => updateSetting('saveDisabled', checked),
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '첨부파일 API 연결',
      definitionName: 'enableDocumentAttachmentApiPath',
      description: '문서 모드에서 첨부파일 상자가 실제 문서 첨부 API를 사용하게 합니다.',
      checked: settings.enableDocumentAttachmentApiPath,
      disabled: workspaceMode === 'template',
      onCheckedChange: (checked: boolean) => updateSetting('enableDocumentAttachmentApiPath', checked),
    },
    {
      sectionKey: 'documentBinding',
      sectionLabel: '문서 연동',
      label: '편집 가능 value 키 제한',
      definitionName: 'limitEditableValueKeys',
      description: '문서 모드에서 전달된 editableValueKeys에 포함된 value 상자만 수정할 수 있게 제한합니다.',
      checked: settings.limitEditableValueKeys,
      disabled: workspaceMode === 'template' || editableValueKeyCandidates.length === 0,
      onCheckedChange: (checked: boolean) => updateSetting('limitEditableValueKeys', checked),
    },
    {
      sectionKey: 'saveInput',
      sectionLabel: '입력/저장',
      label: '저장 완료 콜백 연결',
      definitionName: 'onTemplateSaved',
      description: '템플릿 저장 성공 시 owner 페이지의 저장 후처리 콜백을 실행합니다.',
      checked: settings.enableOnTemplateSaved,
      disabled: workspaceMode !== 'template',
      onCheckedChange: (checked: boolean) => updateSetting('enableOnTemplateSaved', checked),
    },
  ];
  const canvasConfigSections = [
    {
      key: 'display',
      label: '표시 영역',
      description: '공용 캔버스의 헤더, 패널, 알림, 보조 제어 UI 출력 여부입니다.',
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
      section: 'Owner policy',
      name: 'surface',
      value: 'canvas',
      description: 'CanvasOwnedWorkspace가 허용 정책을 검증할 owner surface입니다.',
    },
    {
      section: 'Owner policy',
      name: 'workspaceMode',
      value: workspaceMode,
      description: '공용 캔버스를 템플릿 편집, 문서 기록, 읽기 전용 중 어떤 모드로 여는지 정합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'initialTemplateId',
      value: workspaceMode === 'template' ? selectedTemplateId || '-' : '-',
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
      value: effectiveEditableValueKeys?.length ? effectiveEditableValueKeys.join(', ') : 'null',
      description: '문서 모드에서 수정 가능한 value 키 목록입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hideHeader',
      value: settings.hideHeader ? 'true' : 'false',
      description: '공용 캔버스 내부 헤더 출력 여부를 제어합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'hidePersistencePanel',
      value: settings.hidePersistencePanel ? 'true' : 'false',
      description: '불러오기 및 저장 패널 출력 여부를 제어합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'templateListDisplay',
      value: workspaceMode === 'template' ? settings.templateListDisplay : 'not passed',
      description: '템플릿 목록을 picker 또는 inline으로 출력합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'additionalControlPanels',
      value: templateExtractPanel || settings.showAdditionalControlPanels ? 'enabled' : 'disabled',
      description: 'PDF 추출 등 외부 제어 패널 주입 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'topNotice',
      value: settings.showTopNotice ? 'enabled' : 'disabled',
      description: '공용 캔버스 상단 알림 주입 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'suppressInitialDraftLoadedMessage',
      value: settings.suppressInitialDraftLoadedMessage ? 'true' : 'false',
      description: '초기 초안 로드 알림을 억제합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'headerTitle',
      value: effectiveHeaderTitle,
      description: '공용 캔버스 내부 헤더 제목입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'headerDescription',
      value: effectiveHeaderDescription,
      description: '공용 캔버스 내부 헤더 설명입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'nameFieldLabel',
      value: effectiveNameFieldLabel,
      description: '이름 입력 필드의 라벨입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'saveButtonLabel',
      value: effectiveSaveButtonLabel,
      description: '저장 버튼에 표시되는 문구입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'templateNameReadOnly',
      value: settings.templateNameReadOnly ? 'true' : 'false',
      description: '이름 입력 필드를 읽기 전용으로 둘지 정합니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'saveDisabled',
      value: effectiveSaveDisabled ? 'true' : 'false',
      description: '저장 버튼의 실제 비활성 상태입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'documentAttachmentApiPath',
      value: effectiveDocumentAttachmentApiPath || '-',
      description: '문서 모드 첨부파일 API 경로입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'onTemplateSaved',
      value: workspaceMode === 'template' && settings.enableOnTemplateSaved ? 'enabled' : 'disabled',
      description: '템플릿 저장 후 owner 페이지 콜백 연결 여부입니다.',
    },
    {
      section: 'TemplateEditWorkspaceProps',
      name: 'onSaveDraftHtml',
      value: workspaceMode === 'document' ? 'enabled' : 'disabled',
      description: '문서 모드 저장 콜백 연결 여부입니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'stabilizeInitialLayout',
      value: settings.stabilizeInitialLayout ? 'true' : 'false',
      description: '미리보기 HTML 생성 직후 숨김 측정으로 자동 크기와 peer edge 배치를 확정합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'enableInitialAutoSize',
      value: settings.enableRuntimeInitialAutoSize ? 'true' : 'false',
      description: '런타임 연결 직후 자동 크기 계산을 한 번 더 실행합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventInitialValueClearShrink',
      value: settings.preventInitialValueClearShrink ? 'true' : 'false',
      description: '자동 크기 대상이 아닌 프레임의 미리보기 진입 1회성 축소만 차단합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'preventRuntimeAutoSizeShrink',
      value: settings.preventRuntimeAutoSizeShrink ? 'true' : 'false',
      description: '입력/첨부/서명 이후 런타임 자동 크기 축소를 차단합니다. 기본 OFF입니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterHeightTargets',
      value: !settings.blockPeerClusterHeightTargets ? 'true' : 'false',
      description: '자동 높이 측정에서 peer cluster 높이 대상을 포함합니다.',
    },
    {
      section: 'templateUsagePreviewLayoutDebugOptions',
      name: 'measurePeerClusterWidthTargets',
      value: !settings.blockPeerClusterWidthTargets ? 'true' : 'false',
      description: '자동 너비 측정에서 peer cluster 너비 대상을 포함합니다.',
    },
  ];
  const effectiveTemplateWorkspacePropSections = [
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
  ].map((section) => ({
    ...section,
    rows: effectiveTemplateWorkspacePropRows.filter((row) => row.section === section.sourceSection),
  }));
  const renderCanvasTextSettings = () => (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-700">headerTitle</label>
        <Input className={compactInputClassName} value={settings.headerTitle} onChange={(event) => updateSetting('headerTitle', event.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-700">headerDescription</label>
        <Input
          className={compactInputClassName}
          value={settings.headerDescription}
          onChange={(event) => updateSetting('headerDescription', event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-700">nameFieldLabel</label>
        <Input
          className={compactInputClassName}
          value={settings.nameFieldLabel}
          onChange={(event) => updateSetting('nameFieldLabel', event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-700">saveButtonLabel</label>
        <Input
          className={compactInputClassName}
          value={settings.saveButtonLabel}
          onChange={(event) => updateSetting('saveButtonLabel', event.target.value)}
        />
      </div>
      <div className="space-y-1">
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
              {section.rows.map((row) => (
                <SettingToggleRow
                  key={row.definitionName}
                  label={row.label}
                  sectionLabel={row.sectionLabel}
                  definitionName={row.definitionName}
                  description={row.description}
                  checked={row.checked}
                  disabled={row.disabled}
                  onCheckedChange={row.onCheckedChange}
                />
              ))}
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

        {extractStatusNotice}

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
	            <CardHeader className="space-y-1 p-4 pb-3">
	              <CardTitle className="text-sm">상자 편집 캔버스 환경설정</CardTitle>
	              <CardDescription className="text-xs leading-5">
	                공용 캔버스에 전달되는 설정과 런타임 옵션을 모두 이 위치에서 확인하고 변경합니다.
	              </CardDescription>
	            </CardHeader>
	            <CardContent className="space-y-3 p-4 pt-0">
	              {renderCanvasTextSettings()}
	              {renderCanvasConfigSections()}
	              {renderEffectiveTemplateWorkspaceProps()}
	            </CardContent>
	          </Card>

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
                templateUsagePreviewLayoutDebugOptions={templateUsagePreviewLayoutDebugOptions}
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
                templateUsagePreviewLayoutDebugOptions={templateUsagePreviewLayoutDebugOptions}
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
