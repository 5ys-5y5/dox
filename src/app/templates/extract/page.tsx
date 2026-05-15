'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import type { TemplateEditWorkspaceInitialDraft } from '../../../components/template/TemplateEditWorkspace';
import type {
  TemplateExtractApproveResult,
  TemplateExtractDetailResult,
  TemplateExtractFrameGroupVersion,
  TemplateExtractFrameTextMode,
  TemplateExtractImageFrameTextVersion,
  TemplateExtractNonImageFrameTextVersion,
} from '../../../lib/templateExtractDtos';
import { TEMPLATE_EXTRACT_FRAME_GROUP_VERSION_OPTIONS } from '../../../lib/templateExtractDtos';
import type { TemplateLayoutResizeMode } from '../../../lib/templateDtos';
import {
  applyExtractPhysicalCorrectionsInHtml,
  applyExtractValueCorrectionsInHtml,
} from '../../../lib/templateExtractDraftCorrections';

const DEFAULT_ENGINE_VERSION = '47';
const FIXED_LAYOUT_RESIZE_MODE: TemplateLayoutResizeMode = 'grow_height';
const RECENT_UPLOAD_CACHE_NAME = 'template-extract-recent-upload-v1';
const RECENT_UPLOAD_CACHE_KEY = '/__template_extract_recent_upload__';
const TEMPLATE_SAVE_DOCUMENT_ROOT_ATTR = 'data-template-document-root';
const RASTER_FIRST_ROOT_SELECTOR = '.template-clone--raster-first-v2-structured';

const NON_IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS: Array<{
  value: TemplateExtractNonImageFrameTextVersion;
  label: string;
}> = [
  { value: 'niv1.12', label: 'niv1.12' },
  { value: 'niv1.02', label: 'niv1.02' },
  { value: 'niv1.01', label: 'niv1.01' },
];

const IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS: Array<{
  value: TemplateExtractImageFrameTextVersion;
  label: string;
}> = [
  { value: 'iv3.00', label: 'iv3.00' },
  { value: 'iv2.04', label: 'iv2.04' },
  { value: 'iv2.03', label: 'iv2.03' },
  { value: 'iv2.02', label: 'iv2.02' },
  { value: 'iv2.01', label: 'iv2.01' },
  { value: 'iv2.00', label: 'iv2.00' },
  { value: 'iv1.00', label: 'iv1.00' },
];

type ExtractApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

type RecentPdfUploadMeta = {
  name: string;
  lastModified: number;
  size: number;
};

const buildDraftDetailWithGeneratedHtml = (
  detail: TemplateExtractDetailResult,
  generatedDraftHtml: string
): TemplateExtractDetailResult => ({
  ...detail,
  draft: {
    ...detail.draft,
    generatedDraftHtml,
  },
});

const buildFrameReadyKey = (file: File | null, frameGroupVersion: TemplateExtractFrameGroupVersion) =>
  file ? `${file.name}:${file.lastModified}:${frameGroupVersion}` : '';

const toBaseFileName = (file: File | null) =>
  file ? file.name.replace(/\.pdf$/i, '').trim() || file.name : '';

const encodeRecentUploadHeaderValue = (value: string) => {
  try {
    return encodeURIComponent(value);
  } catch {
    return 'recent-upload.pdf';
  }
};

const decodeRecentUploadHeaderValue = (value: string | null) => {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sanitizeExtractDraftHtmlForTemplateSave = (html: string) => {
  const trimmedHtml = html.trim();

  if (!trimmedHtml || typeof DOMParser === 'undefined') {
    return trimmedHtml;
  }

  const parser = new DOMParser();
  const documentRoot = parser.parseFromString(trimmedHtml, 'text/html');

  documentRoot.querySelectorAll<HTMLElement>(RASTER_FIRST_ROOT_SELECTOR).forEach((element) => {
    element.setAttribute(TEMPLATE_SAVE_DOCUMENT_ROOT_ATTR, 'true');
  });

  documentRoot.querySelectorAll<HTMLStyleElement>('style').forEach((styleElement) => {
    const originalCss = styleElement.textContent || '';

    if (!originalCss.includes(RASTER_FIRST_ROOT_SELECTOR)) {
      return;
    }

    let nextCss = originalCss.replace(
      /\.template-clone--raster-first-v2-structured(?!\[data-template-document-root="true"\])/g,
      `${RASTER_FIRST_ROOT_SELECTOR}[${TEMPLATE_SAVE_DOCUMENT_ROOT_ATTR}="true"]`
    );

    nextCss = nextCss.replace(
      /(\.template-clone--raster-first-v2-structured\[data-template-document-root="true"\]\s*\{)([\s\S]*?)(\})/g,
      (_match, start, body, end) => {
        const cleanedBody = String(body)
          .replace(/^\s*width:\s*fit-content;\s*$/gm, '')
          .replace(/^\s*margin:\s*0\s+auto;\s*$/gm, '')
          .replace(/\n{3,}/g, '\n\n');
        return `${start}${cleanedBody}${end}`;
      }
    );

    if (nextCss !== originalCss) {
      styleElement.textContent = nextCss;
    }
  });

  return documentRoot.body.innerHTML.trim();
};

const loadRecentPdfUploadFromBrowserCache = async (): Promise<File | null> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }

  const cache = await window.caches.open(RECENT_UPLOAD_CACHE_NAME);
  const response = await cache.match(RECENT_UPLOAD_CACHE_KEY);

  if (!response) {
    return null;
  }

  const blob = await response.blob();
  const name = decodeRecentUploadHeaderValue(response.headers.get('x-template-file-name')) || 'recent-upload.pdf';
  const lastModified = Number.parseInt(response.headers.get('x-template-file-last-modified') || '0', 10) || Date.now();
  return new File([blob], name, {
    type: blob.type || 'application/pdf',
    lastModified,
  });
};

const saveRecentPdfUploadToBrowserCache = async (file: File) => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  const cache = await window.caches.open(RECENT_UPLOAD_CACHE_NAME);
  const response = new Response(file, {
    headers: {
      'content-type': file.type || 'application/pdf',
      'x-template-file-name': encodeRecentUploadHeaderValue(file.name),
      'x-template-file-last-modified': String(file.lastModified || Date.now()),
      'x-template-file-size': String(file.size || 0),
    },
  });
  await cache.put(RECENT_UPLOAD_CACHE_KEY, response);
};

const loadRecentPdfUploadMetaFromBrowserCache = async (): Promise<RecentPdfUploadMeta | null> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }

  const cache = await window.caches.open(RECENT_UPLOAD_CACHE_NAME);
  const response = await cache.match(RECENT_UPLOAD_CACHE_KEY);

  if (!response) {
    return null;
  }

  const name = decodeRecentUploadHeaderValue(response.headers.get('x-template-file-name')) || '';
  const lastModified = Number.parseInt(response.headers.get('x-template-file-last-modified') || '0', 10) || 0;
  const size = Number.parseInt(response.headers.get('x-template-file-size') || '0', 10) || 0;

  if (!name) {
    return null;
  }

  return { name, lastModified, size };
};

export type TemplateExtractWorkspaceProps = {
  hideHeader?: boolean;
  showSaveControls?: boolean;
  showPreview?: boolean;
  onDraftReady?: (draft: TemplateEditWorkspaceInitialDraft) => void;
  showStatusSection?: boolean;
  statusResetKey?: number;
  onStatusChange?: (status: TemplateExtractWorkspaceStatus | null) => void;
};

export type TemplateExtractWorkspaceStatus =
  | {
      kind: 'approve';
      message: string;
      templateId: string;
    }
  | {
      kind: 'message';
      message: string;
    };

export function TemplateExtractWorkspace({
  hideHeader = false,
  showSaveControls = true,
  showPreview = true,
  onDraftReady,
  showStatusSection = true,
  statusResetKey = 0,
  onStatusChange,
}: TemplateExtractWorkspaceProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [frameGroupVersion, setFrameGroupVersion] = React.useState<TemplateExtractFrameGroupVersion>('fv1.11');
  const [frameTextExtractionMode, setFrameTextExtractionMode] =
    React.useState<TemplateExtractFrameTextMode>('non_image');
  const [frameTextExtractionVersion, setFrameTextExtractionVersion] =
    React.useState<TemplateExtractNonImageFrameTextVersion>('niv1.12');
  const [imageFrameTextExtractionVersion, setImageFrameTextExtractionVersion] =
    React.useState<TemplateExtractImageFrameTextVersion>('iv2.02');
  const [templateName, setTemplateName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [currentDraft, setCurrentDraft] = React.useState<TemplateExtractDetailResult | null>(null);
  const [currentDraftHtml, setCurrentDraftHtml] = React.useState('');
  const [approveResult, setApproveResult] = React.useState<TemplateExtractApproveResult | null>(null);
  const [frameReadyKey, setFrameReadyKey] = React.useState('');
  const [valueStageDraft, setValueStageDraft] = React.useState<TemplateExtractDetailResult | null>(null);
  const [valueStageHtml, setValueStageHtml] = React.useState('');
  const [versionOptionsVisible, setVersionOptionsVisible] = React.useState(false);
  const [stageActionsVisible, setStageActionsVisible] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const previewBodyRef = React.useRef<HTMLDivElement | null>(null);
  const [recentUploadMeta, setRecentUploadMeta] = React.useState<RecentPdfUploadMeta | null>(null);
  const lastDeliveredDraftKeyRef = React.useRef('');

  React.useEffect(() => {
    if (!message && !approveResult) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage('');
      setApproveResult(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [approveResult, message]);

  React.useEffect(() => {
    if (!statusResetKey) {
      return;
    }

    setMessage('');
    setApproveResult(null);
  }, [statusResetKey]);

  const currentFrameReadyKey = React.useMemo(
    () => buildFrameReadyKey(selectedFile, frameGroupVersion),
    [selectedFile, frameGroupVersion]
  );

  const extractConfigKey = React.useMemo(
    () =>
      [
        selectedFile?.name || '',
        selectedFile?.lastModified || '',
        frameGroupVersion,
        frameTextExtractionMode,
        frameTextExtractionMode === 'image' ? imageFrameTextExtractionVersion : frameTextExtractionVersion,
      ].join('::'),
    [
      selectedFile,
      frameGroupVersion,
      frameTextExtractionMode,
      frameTextExtractionVersion,
      imageFrameTextExtractionVersion,
    ]
  );

  const textExtractionReady = Boolean(selectedFile) && frameReadyKey === currentFrameReadyKey;
  const currentTextVersion =
    frameTextExtractionMode === 'image' ? imageFrameTextExtractionVersion : frameTextExtractionVersion;

  React.useEffect(() => {
    if (!onDraftReady || !currentDraft || !currentDraftHtml.trim()) {
      return;
    }

    const draftKey = `${currentDraft.draft.id}:${extractConfigKey}:${currentDraftHtml.length}`;

    if (lastDeliveredDraftKeyRef.current === draftKey) {
      return;
    }

    lastDeliveredDraftKeyRef.current = draftKey;
    onDraftReady({
      draftKey,
      templateName: templateName.trim() || toBaseFileName(selectedFile) || '새 템플릿 초안',
      sourceDocumentName: selectedFile?.name || null,
      draftHtml: currentDraftHtml.trim(),
      layoutResizeMode: FIXED_LAYOUT_RESIZE_MODE,
    });
  }, [currentDraft, currentDraftHtml, extractConfigKey, onDraftReady, selectedFile, templateName]);

  React.useEffect(() => {
    if (!onStatusChange) {
      return;
    }

    if (approveResult) {
      onStatusChange({
        kind: 'approve',
        message: '템플릿 관리 저장을 완료했습니다.',
        templateId: approveResult.templateId,
      });
      return;
    }

    if (message) {
      onStatusChange({
        kind: 'message',
        message,
      });
      return;
    }

    onStatusChange(null);
  }, [approveResult, message, onStatusChange]);

  const syncPreviewDocumentScale = React.useCallback(() => {
    const root = previewBodyRef.current;

    if (!root) {
      return;
    }

    const clearScale = (element: HTMLElement | null) => {
      if (!element) {
        return;
      }

      element.style.removeProperty('zoom');
      element.removeAttribute('data-template-preview-scale-target');
    };

    const existingScaleTarget = root.querySelector<HTMLElement>('[data-template-preview-scale-target="true"]');
    clearScale(existingScaleTarget);

    const stageSection = root.querySelector<HTMLElement>(':scope > section[data-template-extraction-stage]');
    const pageNode =
      root.querySelector<HTMLElement>(':scope > section[data-template-extraction-stage] > section.page') ||
      root.querySelector<HTMLElement>(':scope > section.page') ||
      root.querySelector<HTMLElement>(':scope > .page-inner');

    const scaleTarget = pageNode || stageSection;

    if (!scaleTarget) {
      return;
    }

    const computedRootStyle = window.getComputedStyle(root);
    const paddingLeft = Number.parseFloat(computedRootStyle.paddingLeft || '0') || 0;
    const paddingRight = Number.parseFloat(computedRootStyle.paddingRight || '0') || 0;
    const availableWidth = Math.max(0, root.clientWidth - paddingLeft - paddingRight);
    const sourceWidth = scaleTarget.scrollWidth || scaleTarget.getBoundingClientRect().width;

    if (!availableWidth || !sourceWidth) {
      return;
    }

    const nextScale = Math.min(1, availableWidth / sourceWidth);
    scaleTarget.setAttribute('data-template-preview-scale-target', 'true');

    if (nextScale < 1) {
      scaleTarget.style.zoom = String(nextScale);
    } else {
      scaleTarget.style.removeProperty('zoom');
    }
  }, []);

  React.useEffect(() => {
    if (!selectedFile) {
      return;
    }

    if (!templateName.trim()) {
      setTemplateName(toBaseFileName(selectedFile));
    }
  }, [selectedFile, templateName]);

  React.useEffect(() => {
    setCurrentDraft(null);
    setCurrentDraftHtml('');
    setValueStageDraft(null);
    setValueStageHtml('');
    setApproveResult(null);
    setMessage('');
  }, [extractConfigKey]);

  React.useEffect(() => {
    setFrameReadyKey('');
  }, [selectedFile, frameGroupVersion]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextMeta = await loadRecentPdfUploadMetaFromBrowserCache();

      if (!cancelled) {
        setRecentUploadMeta(nextMeta);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const root = previewBodyRef.current;

    if (!root || !currentDraftHtml.trim()) {
      return;
    }

    let animationFrameId = 0;
    const run = () => {
      syncPreviewDocumentScale();
    };

    animationFrameId = window.requestAnimationFrame(run);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    resizeObserver?.observe(root);
    window.addEventListener('resize', run);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', run);
    };
  }, [currentDraftHtml, syncPreviewDocumentScale]);

  const commitDraft = React.useCallback(
    (detail: TemplateExtractDetailResult, html: string) => {
      const nextDetail = buildDraftDetailWithGeneratedHtml(detail, html);
      setCurrentDraft(nextDetail);
      setCurrentDraftHtml(html);
      setApproveResult(null);
      return nextDetail;
    },
    []
  );

  const syncSelectedFileToNativeInput = React.useCallback((file: File | null) => {
    const input = fileInputRef.current;

    if (!input) {
      return;
    }

    if (!file) {
      input.value = '';
      return;
    }

    if (typeof DataTransfer === 'undefined') {
      return;
    }

    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
    } catch {
      // Ignore native file input sync failures. selectedFile state remains the source of truth.
    }
  }, []);

  const handleSelectedFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setSelectedFile(nextFile);

    if (!nextFile) {
      return;
    }

    await saveRecentPdfUploadToBrowserCache(nextFile);
    setRecentUploadMeta({
      name: nextFile.name,
      lastModified: nextFile.lastModified,
      size: nextFile.size,
    });
  }, []);

  const handleRestoreRecentUpload = React.useCallback(async () => {
    try {
      const nextFile = await loadRecentPdfUploadFromBrowserCache();

      if (!nextFile) {
        setMessage('최근 업로드한 PDF가 없습니다.');
        return;
      }

      setSelectedFile(nextFile);
      syncSelectedFileToNativeInput(nextFile);
      setRecentUploadMeta({
        name: nextFile.name,
        lastModified: nextFile.lastModified,
        size: nextFile.size,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '최근 업로드한 PDF를 불러오지 못했습니다.');
    }
  }, [syncSelectedFileToNativeInput]);

  const requestExtractDraft = React.useCallback(
    async (extractionStage: 'frames' | 'full') => {
      if (!selectedFile) {
        throw new Error('PDF 파일을 먼저 선택하세요.');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceTitle', toBaseFileName(selectedFile));
      formData.append('engineVersion', DEFAULT_ENGINE_VERSION);
      formData.append('extractionStage', extractionStage);
      formData.append('frameGroupVersion', frameGroupVersion);

      if (extractionStage === 'full') {
        formData.append('frameTextExtractionMode', frameTextExtractionMode);

        if (frameTextExtractionMode === 'image') {
          formData.append('imageFrameTextExtractionVersion', imageFrameTextExtractionVersion);
          formData.append('imageOcrVersion', imageFrameTextExtractionVersion);
        } else {
          formData.append('frameTextExtractionVersion', frameTextExtractionVersion);
        }
      }

      const response = await fetch('/api/templates/extract', {
        method: 'POST',
        body: formData,
      });
      const result = (await response.json()) as ExtractApiResponse<TemplateExtractDetailResult>;

      if (!response.ok || !result.success || !result.data?.draft) {
        throw new Error(result.message || '템플릿 추출 요청에 실패했습니다.');
      }

      return result.data;
    },
    [
      selectedFile,
      frameGroupVersion,
      frameTextExtractionMode,
      frameTextExtractionVersion,
      imageFrameTextExtractionVersion,
    ]
  );

  const handleCreateFrameGroups = React.useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const detail = await requestExtractDraft('frames');
      commitDraft(detail, detail.draft.generatedDraftHtml || '');
      setFrameReadyKey(currentFrameReadyKey);
      setValueStageDraft(null);
      setValueStageHtml('');
      setMessage(`프레임 그룹 생성을 완료했습니다. (${frameGroupVersion})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프레임 그룹 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [commitDraft, currentFrameReadyKey, frameGroupVersion, requestExtractDraft]);

  const handleExtractFrameText = React.useCallback(async () => {
    if (!textExtractionReady) {
      setMessage('프레임 그룹 생성 이후에 실행할 수 있습니다.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const detail = await requestExtractDraft('full');
      commitDraft(detail, detail.draft.generatedDraftHtml || '');
      setValueStageDraft(null);
      setValueStageHtml('');
      setMessage(`프레임 텍스트 추출을 완료했습니다. (${frameTextExtractionMode}, ${currentTextVersion})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프레임 텍스트 추출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [commitDraft, currentTextVersion, frameTextExtractionMode, requestExtractDraft, textExtractionReady]);

  const handleRunValueStage = React.useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const detail = await requestExtractDraft('full');
      const extractedHtml = applyExtractValueCorrectionsInHtml(detail.draft.generatedDraftHtml || '');
      const nextDetail = commitDraft(detail, extractedHtml);
      setValueStageDraft(nextDetail);
      setValueStageHtml(extractedHtml);
      setMessage(`값 추출을 완료했습니다. (${frameGroupVersion} -> ${currentTextVersion})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '값 추출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [commitDraft, currentTextVersion, frameGroupVersion, requestExtractDraft]);

  const handleRunPhysicalStage = React.useCallback(() => {
    if (!valueStageDraft || !valueStageHtml.trim()) {
      setMessage('1. 값 추출 결과가 있어야 물리적 보정을 실행할 수 있습니다.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const physicalHtml = applyExtractPhysicalCorrectionsInHtml(valueStageHtml);
      commitDraft(valueStageDraft, physicalHtml);
      setMessage('물리적 보정을 완료했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '물리적 보정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [commitDraft, valueStageDraft, valueStageHtml]);

  const handleRunFullExtract = React.useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const detail = await requestExtractDraft('full');
      const extractedHtml = applyExtractValueCorrectionsInHtml(detail.draft.generatedDraftHtml || '');
      const valueDetail = buildDraftDetailWithGeneratedHtml(detail, extractedHtml);
      const physicalHtml = applyExtractPhysicalCorrectionsInHtml(extractedHtml);
      commitDraft(valueDetail, physicalHtml);
      setValueStageDraft(valueDetail);
      setValueStageHtml(extractedHtml);
      setMessage(`전체 추출을 완료했습니다. (${frameGroupVersion} -> ${currentTextVersion})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '전체 추출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [commitDraft, currentTextVersion, frameGroupVersion, requestExtractDraft]);

  const handleApprove = React.useCallback(async () => {
    if (!currentDraft?.draft.id || !currentDraftHtml.trim()) {
      setMessage('저장할 초안이 없습니다.');
      return;
    }

    if (!templateName.trim()) {
      setMessage('템플릿 관리 저장 이름을 입력하세요.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const saveDraftHtml = sanitizeExtractDraftHtmlForTemplateSave(currentDraftHtml);
      const response = await fetch(`/api/templates/extract/${currentDraft.draft.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateName: templateName.trim(),
          layoutResizeMode: FIXED_LAYOUT_RESIZE_MODE,
          generatedDraftHtml: saveDraftHtml,
        }),
      });
      const result = (await response.json()) as ExtractApiResponse<TemplateExtractApproveResult>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || '템플릿 저장에 실패했습니다.');
      }

      setApproveResult(result.data);
      setMessage('템플릿 관리 저장을 완료했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentDraft?.draft.id, currentDraftHtml, templateName]);

  const headerSection = hideHeader ? null : (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-950">템플릿 추출</h1>
        <p className="text-sm text-slate-600">
          프레임 그룹 생성, 프레임 텍스트 추출, 전체 추출 단계 실행과 저장만 남긴 페이지입니다.
        </p>
      </div>

      {showSaveControls ? (
        <div className="flex w-full flex-col gap-3 lg:max-w-[560px] lg:flex-row lg:items-end">
          <div className="relative lg:flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm font-medium text-slate-500">
              템플릿 이름:
            </span>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              disabled={loading}
              placeholder=""
              aria-label="템플릿 이름"
              className="pl-[7.75rem]"
            />
          </div>
          <Button
            disabled={loading || !currentDraft || !currentDraftHtml.trim()}
            onClick={() => void handleApprove()}
            className="lg:w-[120px]"
          >
            저장
          </Button>
        </div>
      ) : null}
    </div>
  );

  const statusSection = showStatusSection
    ? approveResult ? (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-950">저장 완료</p>
            <p>템플릿 ID: {approveResult.templateId}</p>
            <a
              href={`/templates/edit?templateId=${approveResult.templateId}`}
              className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              저장된 템플릿 편집하기
            </a>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="알림 닫기"
            title="알림 닫기"
            onClick={() => setApproveResult(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  ) : message ? (
    <Card className="border-slate-200 bg-slate-50">
      <CardContent className="p-4 text-sm text-slate-700">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1">{message}</p>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="알림 닫기"
            title="알림 닫기"
            onClick={() => setMessage('')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  ) : null
    : null;

  const controlsSection = (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>PDF 추출</CardTitle>
          <CardDescription>프레임 버전과 텍스트 버전을 고른 뒤 필요한 단계만 실행합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => void handleSelectedFileChange(event)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
            {recentUploadMeta ? (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void handleRestoreRecentUpload()}
                className="w-full justify-start"
              >
                최근 업로드 불러오기: {recentUploadMeta.name}
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            <div>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => setVersionOptionsVisible((previous) => !previous)}
                className="w-full"
              >
                {versionOptionsVisible ? '버전 숨기기' : '버전 선택하기'}
              </Button>
            </div>
            {versionOptionsVisible ? (
              <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">프레임 그룹 버전</label>
                    <select
                      value={frameGroupVersion}
                      onChange={(event) => setFrameGroupVersion(event.target.value as TemplateExtractFrameGroupVersion)}
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                    >
                      {TEMPLATE_EXTRACT_FRAME_GROUP_VERSION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button variant="outline" disabled={loading || !selectedFile} onClick={() => void handleCreateFrameGroups()}>
                    프레임 그룹 생성
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">텍스트 추출 버전</label>
                  <select
                    value={currentTextVersion}
                    onChange={(event) =>
                      frameTextExtractionMode === 'image'
                        ? setImageFrameTextExtractionVersion(event.target.value as TemplateExtractImageFrameTextVersion)
                        : setFrameTextExtractionVersion(event.target.value as TemplateExtractNonImageFrameTextVersion)
                    }
                    disabled={loading}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                  >
                    {(frameTextExtractionMode === 'image'
                      ? IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS
                      : NON_IMAGE_FRAME_TEXT_EXTRACTION_VERSION_OPTIONS
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-2">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() =>
                        setFrameTextExtractionMode((previous) =>
                          previous === 'image' ? 'non_image' : 'image'
                        )
                      }
                    >
                      {frameTextExtractionMode === 'image' ? '이미지' : '비 이미지'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={loading || !textExtractionReady}
                      onClick={() => void handleExtractFrameText()}
                    >
                      프레임 텍스트 추출
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                <Button disabled={loading || !selectedFile} onClick={() => void handleRunFullExtract()} className="flex-1">
                  전체 추출
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => setStageActionsVisible((previous) => !previous)}
                  aria-label={stageActionsVisible ? '단계 실행 접기' : '단계 실행 펼치기'}
                  title={stageActionsVisible ? '단계 실행 접기' : '단계 실행 펼치기'}
                  className="w-10 shrink-0 px-0"
                >
                  {stageActionsVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
              {stageActionsVisible ? (
                <div className="grid grid-cols-1 gap-2 pl-4">
                  <Button
                    variant="outline"
                    disabled={loading || !selectedFile}
                    onClick={() => void handleRunValueStage()}
                  >
                    1. 값 추출
                  </Button>
                  <Button
                    variant="outline"
                    disabled={loading || !valueStageDraft || !valueStageHtml.trim()}
                    onClick={handleRunPhysicalStage}
                  >
                    2. 물리적 보정
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!showPreview) {
    return (
      <div className="space-y-6">
        {headerSection}
        {statusSection}
        {controlsSection}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {headerSection}

      {statusSection}

      <div className="grid items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">{controlsSection}</div>

        <div className="min-w-0 self-start overflow-hidden rounded-xl border border-slate-200 bg-card text-card-foreground">
          <style>{`
            .template-extract-preview-shell {
              background: rgb(226 232 240);
            }
            .template-extract-preview-shell > section,
            .template-extract-preview-shell > .page-inner,
            .template-extract-preview-shell > .viewer {
              margin-left: auto !important;
              margin-right: auto !important;
            }
            .template-extract-preview-shell > section,
            .template-extract-preview-shell section.page,
            .template-extract-preview-shell .page-inner,
            .template-extract-preview-shell .viewer {
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              box-shadow: none !important;
            }
            .template-extract-preview-shell > section[data-template-extraction-stage],
            .template-extract-preview-shell > section.page {
              display: flex;
              width: 100%;
              flex-direction: column;
              align-items: center;
              background: transparent !important;
            }
            .template-extract-preview-shell > section > section.page,
            .template-extract-preview-shell > section.page,
            .template-extract-preview-shell > .page-inner {
              background: white !important;
            }
            .template-extract-preview-shell section.page {
              position: relative;
              margin: 0 !important;
              overflow: visible;
            }
            .template-extract-preview-shell .page-inner {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
          `}</style>
          <h2 className="border-b border-slate-200 px-6 pt-6 pb-4 text-lg font-semibold text-slate-950">미리보기</h2>
          {currentDraftHtml ? (
            <div
              ref={previewBodyRef}
              className="template-extract-preview-shell min-h-[70vh] overflow-auto"
              dangerouslySetInnerHTML={{ __html: currentDraftHtml }}
            />
          ) : (
            <div className="template-extract-preview-shell flex min-h-[70vh] items-center justify-center text-sm text-slate-500">
              실행 결과가 여기에 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplateExtractPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-6 py-6">
      <TemplateExtractWorkspace />
    </main>
  );
}
