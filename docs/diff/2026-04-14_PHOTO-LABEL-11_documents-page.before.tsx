'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type { DocumentCreateResult, DocumentDetailResult, DocumentListItem } from '../../lib/documentDtos';
import type { ExportJobCreateResult, ExportTargetFormat } from '../../lib/exportDtos';
import type { EmailSendResult } from '../../lib/messagingDtos';
import type { PhotoCreateResult } from '../../lib/photoLabelDtos';
import type { RequestLinkCreateResult, RequestLinkRecordDto } from '../../lib/requestLinkDtos';
import type { SiteRecordDto } from '../../lib/siteChecklistDtos';
import type { TemplateRecordDto } from '../../lib/templateDtos';

const defaultHtmlTemplate = `<section data-document-root="true">
  <h1>현장 서류 예시</h1>
  <p>현장명: <span data-label="site_name">서울 A현장</span></p>
  <p>책임자: <span data-label="manager_name">홍길동</span></p>
</section>`;

const defaultLabelValues = JSON.stringify(
  {
    site_name: '서울 A현장',
    manager_name: '홍길동',
  },
  null,
  2
);

const getStatusVariant = (status: string) => {
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

const getPhotoStatusVariant = (status: string) => {
  switch (status) {
    case 'covered':
      return 'green' as const;
    case 'review_needed':
      return 'amber' as const;
    case 'missing':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

const getRequestLinkStatusVariant = (status: RequestLinkRecordDto['status']) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'submitted':
      return 'amber' as const;
    case 'expired':
    case 'revoked':
      return 'red' as const;
    default:
      return 'slate' as const;
  }
};

type RecentRequestLinkListItem = {
  requestLink: RequestLinkRecordDto;
  documentTitle: string;
  documentTypeKey: string;
  siteId: string;
  maskedRecipientTarget: string;
};

type SelectablePreviewField = {
  labelKey: string;
  displayLabel: string;
  contextText: string;
  currentValue: string;
};

type DocumentTaskMode = 'request' | 'export' | 'photo';

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const humanizeLabelKey = (labelKey: string) =>
  labelKey
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

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

const appendClassNameToAttributes = (attributes: string, className: string) => {
  if (attributes.includes('class="')) {
    return attributes.replace(/class="([^"]*)"/, (_match, existing) => `class="${existing} ${className}"`);
  }

  return `${attributes} class="${className}"`;
};

const buildInteractiveDocumentHtml = (htmlCanonical: string, selectedLabelKeys: string[]) => {
  const selectedSet = new Set(selectedLabelKeys);

  return htmlCanonical.replace(
    /<([a-zA-Z0-9:-]+)([^>]*\sdata-label="([^"]+)"[^>]*)>/g,
    (_match, tagName: string, rawAttributes: string, labelKey: string) => {
      const isSelected = selectedSet.has(labelKey);
      const interactionClass = [
        'cursor-pointer rounded px-1 py-0.5 transition-colors outline-none',
        'focus:bg-slate-100 focus:ring-1 focus:ring-slate-300',
        isSelected ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-100',
      ].join(' ');
      let nextAttributes = appendClassNameToAttributes(rawAttributes, interactionClass);
      nextAttributes += ` data-doc-label="${labelKey}" data-doc-selected="${isSelected ? 'true' : 'false'}" tabindex="0" role="button" aria-pressed="${isSelected ? 'true' : 'false'}"`;
      return `<${tagName}${nextAttributes}>`;
    }
  );
};

export default function DocumentsPage() {
  const [siteId, setSiteId] = React.useState('site-demo-001');
  const [documentTypeKey, setDocumentTypeKey] = React.useState('safety-plan');
  const [title, setTitle] = React.useState('안전관리계획서');
  const [templateId, setTemplateId] = React.useState('');
  const [sites, setSites] = React.useState<SiteRecordDto[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [htmlCanonical, setHtmlCanonical] = React.useState(defaultHtmlTemplate);
  const [labelValuesText, setLabelValuesText] = React.useState(defaultLabelValues);
  const [documents, setDocuments] = React.useState<DocumentListItem[]>([]);
  const [latestCreated, setLatestCreated] = React.useState<DocumentCreateResult | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState('');
  const [selectedDocumentDetail, setSelectedDocumentDetail] = React.useState<DocumentDetailResult | null>(null);
  const [selectedDocumentRequestLinks, setSelectedDocumentRequestLinks] = React.useState<RecentRequestLinkListItem[]>([]);
  const [versionHtmlCanonical, setVersionHtmlCanonical] = React.useState(defaultHtmlTemplate);
  const [versionLabelValuesText, setVersionLabelValuesText] = React.useState(defaultLabelValues);
  const [changeReason, setChangeReason] = React.useState('오타 수정');
  const [quickRecipientTarget, setQuickRecipientTarget] = React.useState('');
  const [quickRecipientName, setQuickRecipientName] = React.useState('현장 담당자');
  const [selectedAllowedLabels, setSelectedAllowedLabels] = React.useState<string[]>([]);
  const [quickRequestedBy, setQuickRequestedBy] = React.useState('docs-ops-user');
  const [quickLinkExpiresAt, setQuickLinkExpiresAt] = React.useState('2026-04-21T18:00');
  const [latestQuickRequestLink, setLatestQuickRequestLink] = React.useState<RequestLinkCreateResult | null>(null);
  const [latestQuickEmailDispatch, setLatestQuickEmailDispatch] = React.useState<EmailSendResult | null>(null);
  const [latestQuickExport, setLatestQuickExport] = React.useState<ExportJobCreateResult | null>(null);
  const [quickPhotoTitle, setQuickPhotoTitle] = React.useState('문서 증빙 사진');
  const [quickPhotoDescription, setQuickPhotoDescription] = React.useState('');
  const [quickPhotoCapturedAt, setQuickPhotoCapturedAt] = React.useState('');
  const [quickPhotoFile, setQuickPhotoFile] = React.useState<File | null>(null);
  const [selectedPhotoRequirementKeys, setSelectedPhotoRequirementKeys] = React.useState<string[]>([]);
  const [latestQuickPhoto, setLatestQuickPhoto] = React.useState<PhotoCreateResult | null>(null);
  const [previewFields, setPreviewFields] = React.useState<SelectablePreviewField[]>([]);
  const [activeTaskMode, setActiveTaskMode] = React.useState<DocumentTaskMode>('request');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const requestPreviewRef = React.useRef<HTMLDivElement | null>(null);
  const previousPhotoDocumentIdRef = React.useRef('');

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

  const templateOptions = React.useMemo(
    () =>
      templates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.sourceDocumentName || template.id,
      })),
    [templates]
  );

  const documentOptions = React.useMemo(
    () =>
      documents.map((item) => ({
        id: item.document.id,
        label: item.document.title,
        meta: `${item.document.documentTypeKey} / ${item.document.id}`,
      })),
    [documents]
  );

  const loadSites = React.useCallback(async () => {
    try {
      const response = await fetch('/api/sites', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '현장 목록 조회에 실패했습니다.');
      }

      const nextSites = result.data.sites as SiteRecordDto[];
      setSites(nextSites);
      setSiteId((previous) => {
        if (previous && nextSites.some((site) => site.id === previous)) {
          return previous;
        }

        return nextSites[0]?.id || previous;
      });
    } catch {
      // 목록 조회 실패는 화면 전체를 막지 않습니다.
    }
  }, []);

  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch('/api/templates?limit=20', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 목록 조회에 실패했습니다.');
      }

      setTemplates((result.data || []) as TemplateRecordDto[]);
    } catch {
      // 목록 조회 실패는 템플릿 선택만 비웁니다.
    }
  }, []);

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents?siteId=${encodeURIComponent(siteId)}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 목록 조회에 실패했습니다.');
      }

      const nextDocuments = result.data as DocumentListItem[];
      setDocuments(nextDocuments);
      setSelectedDocumentId((previous) => {
        if (previous && nextDocuments.some((item) => item.document.id === previous)) {
          return previous;
        }
        return nextDocuments[0]?.document.id || '';
      });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 목록 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadDocumentDetail = React.useCallback(async (documentId: string) => {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) {
      setSelectedDocumentDetail(null);
      setSelectedDocumentRequestLinks([]);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/documents/${normalizedDocumentId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 상세 조회에 실패했습니다.');
      }

      setSelectedDocumentDetail(result.data);
      setSelectedDocumentId(normalizedDocumentId);

      try {
        const requestLinksResponse = await fetch(
          `/api/request-links?siteId=${encodeURIComponent(result.data.document.siteId)}&limit=20`,
          { cache: 'no-store' }
        );
        const requestLinksResult = await requestLinksResponse.json();

        if (requestLinksResult.success) {
          const documentRequestLinks = (requestLinksResult.data as RecentRequestLinkListItem[]).filter(
            (item) => item.requestLink.documentId === normalizedDocumentId
          );
          setSelectedDocumentRequestLinks(documentRequestLinks);
        } else {
          setSelectedDocumentRequestLinks([]);
        }
      } catch {
        setSelectedDocumentRequestLinks([]);
      }

      const latestVersion = result.data.latestVersion;
      if (latestVersion) {
        setVersionHtmlCanonical(latestVersion.htmlCanonical);
        setVersionLabelValuesText(JSON.stringify(latestVersion.labelValues, null, 2));
      }
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 상세 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  React.useEffect(() => {
    void loadSites();
    void loadTemplates();
  }, [loadSites, loadTemplates]);

  React.useEffect(() => {
    if (selectedDocumentId.trim()) {
      setActiveTaskMode('request');
      void loadDocumentDetail(selectedDocumentId);
    } else {
      setSelectedDocumentDetail(null);
      setSelectedDocumentRequestLinks([]);
    }
  }, [loadDocumentDetail, selectedDocumentId]);

  React.useEffect(() => {
    const latestRequestLink = selectedDocumentRequestLinks[0]?.requestLink;
    if (!latestRequestLink) {
      setQuickRecipientTarget('');
      setQuickRecipientName('현장 담당자');
      setSelectedAllowedLabels([]);
      return;
    }

    setQuickRecipientTarget(latestRequestLink.recipientTarget || '');
    setQuickRecipientName(latestRequestLink.recipientName || '현장 담당자');
    setSelectedAllowedLabels(latestRequestLink.allowedLabels);
  }, [selectedDocumentRequestLinks]);

  React.useEffect(() => {
    const activeDocument = selectedDocumentDetail?.document;
    const activeRequirements = selectedDocumentDetail?.photoEvidence.requirements || [];
    const availableKeys = new Set(activeRequirements.map((requirement) => requirement.labelKey));
    const activeDocumentId = activeDocument?.id || '';
    const documentChanged = previousPhotoDocumentIdRef.current !== activeDocumentId;

    setSelectedPhotoRequirementKeys((previous) => previous.filter((labelKey) => availableKeys.has(labelKey)));

    if (!activeDocument) {
      setQuickPhotoTitle('문서 증빙 사진');
      setQuickPhotoDescription('');
      setQuickPhotoFile(null);
      setLatestQuickPhoto(null);
      previousPhotoDocumentIdRef.current = '';
      return;
    }

    if (documentChanged) {
      setQuickPhotoTitle(`${activeDocument.title} 증빙 사진`);
      setQuickPhotoDescription(`${activeDocument.title}에 필요한 현장 증빙 사진`);
      setQuickPhotoFile(null);
      setLatestQuickPhoto(null);
    }

    previousPhotoDocumentIdRef.current = activeDocumentId;
  }, [selectedDocumentDetail?.document, selectedDocumentDetail?.photoEvidence.requirements]);

  const interactivePreviewHtml = React.useMemo(() => {
    const htmlCanonical = selectedDocumentDetail?.latestVersion?.htmlCanonical || '';
    if (!htmlCanonical) {
      return '';
    }

    return buildInteractiveDocumentHtml(htmlCanonical, selectedAllowedLabels);
  }, [selectedAllowedLabels, selectedDocumentDetail?.latestVersion?.htmlCanonical]);

  React.useEffect(() => {
    const previewRoot = requestPreviewRef.current;
    const latestVersion = selectedDocumentDetail?.latestVersion;

    if (!previewRoot || !latestVersion || !interactivePreviewHtml || activeTaskMode !== 'request') {
      setPreviewFields([]);
      return;
    }

    const nextFields: SelectablePreviewField[] = [];
    const seenLabels = new Set<string>();
    const interactiveNodes = Array.from(previewRoot.querySelectorAll<HTMLElement>('[data-doc-label]'));

    interactiveNodes.forEach((element) => {
      const labelKey = element.dataset.docLabel?.trim();
      if (!labelKey || seenLabels.has(labelKey)) {
        return;
      }

      seenLabels.add(labelKey);
      const currentValue = stringifyDocumentValue(latestVersion.labelValues[labelKey]);
      const containerText = collapseWhitespace(
        (element.closest('tr, p, li, section, div, td') as HTMLElement | null)?.textContent || element.textContent || ''
      );
      const displayLabel = collapseWhitespace(containerText.replace(currentValue, '')).replace(/[:：]\s*$/, '');

      nextFields.push({
        labelKey,
        displayLabel: displayLabel || humanizeLabelKey(labelKey),
        contextText: containerText || humanizeLabelKey(labelKey),
        currentValue,
      });
    });

    setPreviewFields(nextFields);
  }, [activeTaskMode, interactivePreviewHtml, selectedDocumentDetail?.latestVersion]);

  React.useEffect(() => {
    if (previewFields.length === 0) {
      return;
    }

    const availableLabels = new Set(previewFields.map((field) => field.labelKey));
    setSelectedAllowedLabels((previous) => previous.filter((labelKey) => availableLabels.has(labelKey)));
  }, [previewFields]);

  const previewFieldMap = React.useMemo(
    () => Object.fromEntries(previewFields.map((field) => [field.labelKey, field])),
    [previewFields]
  );

  const selectedPreviewFields = React.useMemo(
    () =>
      selectedAllowedLabels.map((labelKey) => {
        const matchedField = previewFieldMap[labelKey];
        if (matchedField) {
          return matchedField;
        }

        return {
          labelKey,
          displayLabel: humanizeLabelKey(labelKey),
          contextText: humanizeLabelKey(labelKey),
          currentValue: '',
        } satisfies SelectablePreviewField;
      }),
    [previewFieldMap, selectedAllowedLabels]
  );

  const documentPreviewHtml = selectedDocumentDetail?.latestVersion?.htmlCanonical || '';

  const toggleAllowedLabel = React.useCallback((labelKey: string) => {
    setSelectedAllowedLabels((previous) =>
      previous.includes(labelKey)
        ? previous.filter((item) => item !== labelKey)
        : [...previous, labelKey]
    );
  }, []);

  const handlePreviewClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const labelElement = (event.target as HTMLElement).closest<HTMLElement>('[data-doc-label]');
      const labelKey = labelElement?.dataset.docLabel?.trim();

      if (!labelKey) {
        return;
      }

      toggleAllowedLabel(labelKey);
    },
    [toggleAllowedLabel]
  );

  const handlePreviewKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      const labelElement = (event.target as HTMLElement).closest<HTMLElement>('[data-doc-label]');
      const labelKey = labelElement?.dataset.docLabel?.trim();

      if (!labelKey) {
        return;
      }

      event.preventDefault();
      toggleAllowedLabel(labelKey);
    },
    [toggleAllowedLabel]
  );

  const handleCreateDocument = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const labelValues = JSON.parse(labelValuesText) as Record<string, unknown>;
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          documentTypeKey,
          title,
          templateId: templateId.trim() || null,
          htmlCanonical,
          labelValues,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 생성에 실패했습니다.');
      }

      setLatestCreated(result.data);
      setSelectedDocumentId(result.data.document.id);
      setMessage('문서 메타데이터와 초기 버전이 저장되었습니다.');
      await loadDocuments();
      await loadDocumentDetail(result.data.document.id);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    const normalizedDocumentId = selectedDocumentId.trim();

    if (!normalizedDocumentId) {
      setMessage('버전을 추가할 문서를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const labelValues = JSON.parse(versionLabelValuesText) as Record<string, unknown>;
      const response = await fetch(`/api/documents/${normalizedDocumentId}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCanonical: versionHtmlCanonical,
          labelValues,
          changeReason,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '문서 버전 생성에 실패했습니다.');
      }

      setMessage(`문서 버전 ${result.data.latestVersion.versionNumber} 이 저장되었습니다.`);
      await loadDocuments();
      await loadDocumentDetail(normalizedDocumentId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '문서 버전 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndSendEmailRequest = async () => {
    const activeDocument = selectedDocumentDetail?.document;

    if (!activeDocument) {
      setMessage('먼저 문서를 선택하세요.');
      return;
    }

    if (!quickRecipientTarget.trim()) {
      setMessage('받는 이메일 주소를 입력하세요.');
      return;
    }

    const allowedLabels = selectedAllowedLabels.filter(Boolean);

    if (allowedLabels.length === 0) {
      setMessage('왼쪽 문서에서 요청할 항목을 하나 이상 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const createResponse = await fetch('/api/request-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDocument.id,
          allowedLabels,
          recipientChannel: 'email',
          recipientTarget: quickRecipientTarget.trim(),
          recipientName: quickRecipientName.trim() || null,
          expiresAt: new Date(quickLinkExpiresAt).toISOString(),
          oneTimeUse: true,
          requestedBy: quickRequestedBy.trim() || null,
        }),
      });
      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.message || '요청 링크 생성에 실패했습니다.');
      }

      const requestLinkId = createResult.data.requestLink.id;
      const dispatchUrlResponse = await fetch(
        `/api/request-links?dispatchUrlFor=${encodeURIComponent(requestLinkId)}`,
        { cache: 'no-store' }
      );
      const dispatchUrlResult = await dispatchUrlResponse.json();

      if (!dispatchUrlResult.success) {
        throw new Error(dispatchUrlResult.message || '발송용 요청 링크 URL 생성에 실패했습니다.');
      }

      const requestLinkUrl = `${window.location.origin}${dispatchUrlResult.data.maskedUrl}`;
      const subject = `[MEJAI] 문서 입력 요청: ${activeDocument.title}`;
      const htmlBody = [
        '<div>',
        `<p>안녕하세요${quickRecipientName.trim() ? `, ${quickRecipientName.trim()}님` : ''}.</p>`,
        `<p>${activeDocument.title} 관련 요청 링크를 전달드립니다.</p>`,
        `<p><a href="${requestLinkUrl}">요청 링크 열기</a></p>`,
        `<p>${requestLinkUrl}</p>`,
        '</div>',
      ].join('');

      const emailResponse = await fetch('/api/messaging/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestLinkId,
          requestedBy: quickRequestedBy.trim() || null,
          subject,
          htmlBody,
        }),
      });
      const emailResult = await emailResponse.json();

      if (!emailResult.success) {
        throw new Error(emailResult.message || '이메일 발송에 실패했습니다.');
      }

      setLatestQuickRequestLink(createResult.data);
      setLatestQuickEmailDispatch(emailResult.data);
      setMessage(
        `요청 링크를 만들고 이메일까지 보냈습니다. 상태: ${emailResult.data.dispatch.status} / 성공 ${emailResult.data.dispatch.sentCount}건`
      );
      await loadDocumentDetail(activeDocument.id);
      await loadDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '요청 링크 이메일 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickExport = async (targetFormat: ExportTargetFormat) => {
    const activeDocument = selectedDocumentDetail?.document;

    if (!activeDocument) {
      setMessage('먼저 문서를 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDocument.id,
          targetFormat,
          requestedBy: quickRequestedBy.trim() || null,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '출력본 생성에 실패했습니다.');
      }

      setLatestQuickExport(result.data);
      await loadDocumentDetail(activeDocument.id);
      await loadDocuments();

      if (result.data.job.downloadReady && result.data.job.downloadUrl) {
        window.location.href = result.data.job.downloadUrl;
      } else {
        setMessage(`${targetFormat.toUpperCase()} 요청을 만들었습니다. 현재 상태: ${result.data.job.status}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '출력본 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDocumentSummary = selectedDocumentDetail?.document || null;
  const latestRecentRequestLink = selectedDocumentRequestLinks[0]?.requestLink || null;
  const currentPhotoRequirements = selectedDocumentDetail?.photoEvidence.requirements || [];

  const togglePhotoRequirement = React.useCallback((labelKey: string) => {
    setSelectedPhotoRequirementKeys((previous) =>
      previous.includes(labelKey)
        ? previous.filter((item) => item !== labelKey)
        : [...previous, labelKey]
    );
  }, []);

  const handleUploadAndConnectPhotoEvidence = async () => {
    const activeDocument = selectedDocumentDetail?.document;

    if (!activeDocument) {
      setMessage('먼저 문서를 선택하세요.');
      return;
    }

    if (!quickPhotoFile) {
      setMessage('업로드할 이미지 파일을 먼저 선택하세요.');
      return;
    }

    if (selectedPhotoRequirementKeys.length === 0) {
      setMessage('오른쪽에서 이 사진이 증빙하는 항목을 하나 이상 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('siteId', activeDocument.siteId);
      formData.append('photoTitle', quickPhotoTitle.trim() || `${activeDocument.title} 증빙 사진`);
      formData.append('description', quickPhotoDescription.trim() || `${activeDocument.title} 증빙 사진`);
      formData.append('capturedAt', quickPhotoCapturedAt ? new Date(quickPhotoCapturedAt).toISOString() : '');
      formData.append('file', quickPhotoFile);

      const uploadResponse = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.message || '사진 업로드에 실패했습니다.');
      }

      const createdPhoto = uploadResult.data as PhotoCreateResult;
      const manualLabels = selectedPhotoRequirementKeys.map((labelKey) => {
        const matchedRequirement = currentPhotoRequirements.find((requirement) => requirement.labelKey === labelKey);
        return {
          labelKey,
          note: matchedRequirement?.labelName || null,
        };
      });

      const labelsResponse = await fetch('/api/photos/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId: createdPhoto.photo.id,
          manualLabels,
          suggestedLabels: [],
        }),
      });
      const labelsResult = await labelsResponse.json();

      if (!labelsResult.success) {
        throw new Error(labelsResult.message || '사진 증빙 연결에 실패했습니다.');
      }

      setLatestQuickPhoto(createdPhoto);
      setQuickPhotoFile(null);
      setSelectedPhotoRequirementKeys([]);
      setMessage(`사진 업로드와 증빙 항목 ${manualLabels.length}개 연결을 완료했습니다.`);
      await loadDocumentDetail(activeDocument.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사진 업로드와 증빙 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">DOC-CLOUD-10</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">서류 클라우드 관리</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            문서 한 건을 고른 뒤, 문서를 가장 크게 보면서 필요한 작업만 오른쪽에서 처리하는 화면입니다. 개발자용 등록·편집 기능은
            아래 `고급 편집` 안으로 숨기고, 기본 화면은 선택, 상태 확인, 단계형 작업 실행에만 집중합니다. 사진 증빙도 이제
            같은 문서 화면에서 바로 올리고 연결합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadDocuments()} disabled={loading}>
            목록 새로고침
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>1. 작업할 문서 고르기</CardTitle>
            <CardDescription>현장과 문서를 고르면, 오른쪽에서 바로 전송과 출력 작업을 실행할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">현장 선택</label>
              <EntityPicker
                value={siteId}
                options={siteOptions}
                onChange={setSiteId}
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

            {selectedDocumentSummary ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getStatusVariant(selectedDocumentSummary.status)}>
                    {selectedDocumentSummary.status}
                  </Badge>
                  <span className="font-medium text-slate-900">{selectedDocumentSummary.title}</span>
                </div>
                <div className="mt-3 space-y-1">
                  <p>문서 종류: {selectedDocumentSummary.documentTypeKey}</p>
                  <p>최신 버전: {selectedDocumentDetail?.latestVersion?.versionNumber ?? '-'}</p>
                  <p>출력본: {selectedDocumentDetail?.artifacts.length ?? 0}건</p>
                  <p>최근 요청 링크: {selectedDocumentRequestLinks.length}건</p>
                  <p>사진 증빙: {selectedDocumentDetail?.photoEvidence.status ?? '-'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">먼저 작업할 문서를 고르세요.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>2. 지금 할 작업</CardTitle>
              <CardDescription>먼저 할 일을 고르고, 왼쪽 큰 문서를 보면서 오른쪽에서 필요한 설정만 진행합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedDocumentDetail ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">1단계. 무엇을 할지 고르기</p>
                      <p className="mt-1 text-xs text-slate-500">
                        문서를 기준으로 진행할 작업을 먼저 고르면, 아래에서 문서를 크게 보면서 필요한 설정만 이어집니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={activeTaskMode === 'request' ? 'default' : 'outline'}
                        onClick={() => setActiveTaskMode('request')}
                        disabled={loading}
                      >
                        요청 링크 보내기
                      </Button>
                      <Button
                        variant={activeTaskMode === 'export' ? 'default' : 'outline'}
                        onClick={() => setActiveTaskMode('export')}
                        disabled={loading}
                      >
                        출력본 만들기
                      </Button>
                      <Button
                        variant={activeTaskMode === 'photo' ? 'default' : 'outline'}
                        onClick={() => setActiveTaskMode('photo')}
                        disabled={loading}
                      >
                        사진 증빙 확인
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.8fr_0.9fr]">
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          2단계. 문서를 보면서 확인하기
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {activeTaskMode === 'request'
                            ? '문서 안에서 요청할 값을 직접 클릭하세요. 다시 클릭하면 선택이 해제됩니다.'
                            : activeTaskMode === 'export'
                              ? '이 문서의 현재 내용을 그대로 보면서 어떤 출력본을 만들지 오른쪽에서 선택합니다.'
                              : '이 문서와 연결된 사진 증빙 상태를 오른쪽 요약과 함께 확인합니다.'}
                        </p>
                      </div>
                      {documentPreviewHtml ? (
                        <div
                          ref={requestPreviewRef}
                          onClick={activeTaskMode === 'request' ? handlePreviewClick : undefined}
                          onKeyDown={activeTaskMode === 'request' ? handlePreviewKeyDown : undefined}
                          className="min-h-[560px] max-h-[760px] overflow-auto rounded-lg border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mb-3 [&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_li]:mb-1"
                          dangerouslySetInnerHTML={{
                            __html: activeTaskMode === 'request' ? interactivePreviewHtml : documentPreviewHtml,
                          }}
                        />
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
                          최신 문서 본문이 없어 화면에 크게 표시할 내용이 없습니다.
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      {activeTaskMode === 'request' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">3단계. 요청 링크 설정</p>
                            <p className="mt-1 text-xs text-slate-500">
                              문서에서 선택한 항목과 받는 사람만 확인하면 이메일까지 한 번에 처리합니다.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-800">받는 이메일</label>
                            <Input
                              value={quickRecipientTarget}
                              onChange={(event) => setQuickRecipientTarget(event.target.value)}
                              placeholder="example@domain.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-800">받는 사람 이름</label>
                            <Input
                              value={quickRecipientName}
                              onChange={(event) => setQuickRecipientName(event.target.value)}
                              placeholder="현장 담당자"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-800">만료 시각</label>
                            <Input
                              type="datetime-local"
                              value={quickLinkExpiresAt}
                              onChange={(event) => setQuickLinkExpiresAt(event.target.value)}
                            />
                          </div>
                          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-900">선택한 요청 항목</p>
                              <Badge variant="slate">{selectedPreviewFields.length}개</Badge>
                            </div>
                            {selectedPreviewFields.length > 0 ? (
                              <div className="space-y-2">
                                {selectedPreviewFields.map((field) => (
                                  <button
                                    key={field.labelKey}
                                    type="button"
                                    onClick={() => toggleAllowedLabel(field.labelKey)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                                  >
                                    <p className="font-medium text-slate-900">{field.displayLabel}</p>
                                    {field.currentValue ? (
                                      <p className="mt-1 text-xs text-slate-500">현재 값: {field.currentValue}</p>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">왼쪽 문서에서 요청할 값을 클릭하세요.</p>
                            )}
                          </div>
                          <Button onClick={handleCreateAndSendEmailRequest} disabled={loading}>
                            요청 링크 만들고 이메일 보내기
                          </Button>
                          {latestQuickEmailDispatch ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p>이메일 상태: {latestQuickEmailDispatch.dispatch.status}</p>
                              <p>성공: {latestQuickEmailDispatch.dispatch.sentCount}건</p>
                              <p>실패: {latestQuickEmailDispatch.dispatch.failedCount}건</p>
                              {latestQuickRequestLink ? (
                                <p>방금 만든 요청 링크: {latestQuickRequestLink.requestLink.id}</p>
                              ) : null}
                            </div>
                          ) : latestRecentRequestLink ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p>최근 요청 링크 상태: {latestRecentRequestLink.status}</p>
                              <p>최근 수신자: {latestRecentRequestLink.recipientTarget}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : activeTaskMode === 'export' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">3단계. 출력본 만들기</p>
                            <p className="mt-1 text-xs text-slate-500">
                              왼쪽 문서를 확인한 뒤 필요한 출력 형식을 바로 만듭니다.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void handleQuickExport('pdf')} disabled={loading}>
                              PDF 만들기
                            </Button>
                            <Button variant="outline" onClick={() => void handleQuickExport('docx')} disabled={loading}>
                              DOCX 만들기
                            </Button>
                            <Button variant="outline" onClick={() => void handleQuickExport('hwp')} disabled={loading}>
                              HWP 요청
                            </Button>
                          </div>
                          {latestQuickExport ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p>최근 출력본: {latestQuickExport.job.targetFormat.toUpperCase()}</p>
                              <p>상태: {latestQuickExport.job.status}</p>
                              <p>다운로드 가능: {latestQuickExport.job.downloadReady ? '예' : '아니오'}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
                              아직 이 화면에서 만든 출력본이 없습니다.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">3단계. 사진 증빙 확인</p>
                            <p className="mt-1 text-xs text-slate-500">
                              문서를 보면서 부족한 사진 항목을 확인하고, 같은 화면에서 바로 사진을 올려 증빙 연결까지 끝냅니다.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={getPhotoStatusVariant(selectedDocumentDetail.photoEvidence.status)}>
                                {selectedDocumentDetail.photoEvidence.status}
                              </Badge>
                              <span>요구 {selectedDocumentDetail.photoEvidence.requirementCount}개</span>
                              <span>충족 {selectedDocumentDetail.photoEvidence.coveredCount}개</span>
                              <span>검토 필요 {selectedDocumentDetail.photoEvidence.reviewNeededCount}개</span>
                              <span>누락 {selectedDocumentDetail.photoEvidence.missingCount}개</span>
                            </div>
                            {selectedDocumentDetail.photoEvidence.requirements.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {selectedDocumentDetail.photoEvidence.requirements.map((requirement) => (
                                  <div
                                    key={requirement.labelKey}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-medium text-slate-900">{requirement.displayName}</p>
                                      <Badge variant={getPhotoStatusVariant(requirement.status)}>
                                        {requirement.status}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                      충족 {requirement.coveredPhotoCount} / 검토 필요 {requirement.reviewNeededPhotoCount} / 누락 {requirement.missingPhotoCount}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {currentPhotoRequirements.length > 0 ? (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="text-sm font-medium text-slate-800">이 사진이 증빙하는 항목</label>
                                  <Badge variant="slate">{selectedPhotoRequirementKeys.length}개 선택</Badge>
                                </div>
                                <div className="space-y-2">
                                  {currentPhotoRequirements.map((requirement) => {
                                    const isSelected = selectedPhotoRequirementKeys.includes(requirement.labelKey);
                                    return (
                                      <button
                                        key={requirement.requirementId}
                                        type="button"
                                        onClick={() => togglePhotoRequirement(requirement.labelKey)}
                                        className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                                          isSelected ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white hover:bg-slate-100'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="font-medium text-slate-900">{requirement.labelName}</p>
                                          <Badge variant={getPhotoStatusVariant(requirement.coverageStatus)}>
                                            {requirement.coverageStatus}
                                          </Badge>
                                        </div>
                                        {requirement.description ? (
                                          <p className="mt-1 text-xs text-slate-500">{requirement.description}</p>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-800">촬영 시각</label>
                                <Input
                                  type="datetime-local"
                                  value={quickPhotoCapturedAt}
                                  onChange={(event) => setQuickPhotoCapturedAt(event.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-800">사진 제목</label>
                                <Input
                                  value={quickPhotoTitle}
                                  onChange={(event) => setQuickPhotoTitle(event.target.value)}
                                  placeholder="현장 증빙 사진"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-800">사진 설명</label>
                                <textarea
                                  value={quickPhotoDescription}
                                  onChange={(event) => setQuickPhotoDescription(event.target.value)}
                                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-800">이미지 파일</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => setQuickPhotoFile(event.target.files?.[0] || null)}
                                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                />
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                                  {quickPhotoFile ? (
                                    <>
                                      <p>선택된 파일: {quickPhotoFile.name}</p>
                                      <p>파일 크기: {quickPhotoFile.size.toLocaleString()} bytes</p>
                                    </>
                                  ) : (
                                    <p>아직 선택된 파일이 없습니다.</p>
                                  )}
                                </div>
                              </div>

                              <Button onClick={handleUploadAndConnectPhotoEvidence} disabled={loading}>
                                사진 업로드하고 증빙 연결
                              </Button>

                              {latestQuickPhoto ? (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                  <p>방금 저장한 사진: {latestQuickPhoto.photo.photoTitle || '제목 없는 사진'}</p>
                                  <p>저장 상태: {latestQuickPhoto.photo.status}</p>
                                  <p>저장 경로: {latestQuickPhoto.photo.storagePath || '-'}</p>
                                  {latestQuickPhoto.photo.photoUrl ? (
                                    <a
                                      href={latestQuickPhoto.photo.photoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-2 inline-flex text-xs font-medium text-slate-700 underline underline-offset-4"
                                    >
                                      업로드된 사진 보기
                                    </a>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                              이 문서 종류에는 연결된 사진 증빙 요구가 없습니다. 추가 관리가 필요하면 사진 화면에서 고급 설정을 사용하세요.
                            </div>
                          )}
                          <Button asChild variant="outline">
                            <Link
                              href={`/photos?siteId=${encodeURIComponent(selectedDocumentDetail.document.siteId)}&documentId=${encodeURIComponent(selectedDocumentDetail.document.id)}`}
                            >
                              사진 운영 화면 열기
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">문서를 고르면 이 자리에서 바로 작업을 시작할 수 있습니다.</p>
              )}
            </CardContent>
          </Card>

          {selectedDocumentDetail ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>3. 이 문서 기록</CardTitle>
                <CardDescription>현재 문서의 버전, 출력본, 요청 링크, 사진 증빙 기록을 한 번에 봅니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getStatusVariant(selectedDocumentDetail.document.status)}>
                      {selectedDocumentDetail.document.status}
                    </Badge>
                    <span className="font-medium text-slate-900">{selectedDocumentDetail.document.title}</span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">버전 이력</p>
                    <div className="space-y-2">
                      {selectedDocumentDetail.versions.map((version) => (
                        <div key={version.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                          <p className="font-medium text-slate-900">버전 {version.versionNumber}</p>
                          <p>변경 사유: {version.changeReason || '-'}</p>
                          <p>생성 시각: {version.createdAt}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">출력본 이력</p>
                    {selectedDocumentDetail.artifacts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDocumentDetail.artifacts.map((artifact) => (
                          <div key={artifact.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="slate">{artifact.artifactFormat}</Badge>
                              <span className="font-medium text-slate-900">{artifact.status}</span>
                            </div>
                            <p className="mt-2">생성 시각: {artifact.createdAt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">연결된 출력본이 없습니다.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">최근 요청 링크</p>
                    {selectedDocumentRequestLinks.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDocumentRequestLinks.map((item) => (
                          <div key={item.requestLink.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={getRequestLinkStatusVariant(item.requestLink.status)}>
                                {item.requestLink.status}
                              </Badge>
                              <span className="font-medium text-slate-900">{item.maskedRecipientTarget}</span>
                            </div>
                            <p className="mt-2">수신 채널: {item.requestLink.recipientChannel}</p>
                            <p>만료 시각: {item.requestLink.expiresAt}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">최근 요청 링크가 없습니다.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">사진 증빙 요약</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getPhotoStatusVariant(selectedDocumentDetail.photoEvidence.status)}>
                          {selectedDocumentDetail.photoEvidence.status}
                        </Badge>
                        <span>요구 {selectedDocumentDetail.photoEvidence.requirementCount}개</span>
                        <span>충족 {selectedDocumentDetail.photoEvidence.coveredCount}개</span>
                        <span>검토 필요 {selectedDocumentDetail.photoEvidence.reviewNeededCount}개</span>
                        <span>누락 {selectedDocumentDetail.photoEvidence.missingCount}개</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
              고급 편집 열기
            </summary>
            <div className="space-y-6 border-t border-slate-200 px-4 py-4">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>새 문서 등록</CardTitle>
                  <CardDescription>새 문서와 초기 버전을 직접 만드는 고급 기능입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">문서 종류 키</label>
                      <Input
                        value={documentTypeKey}
                        onChange={(event) => setDocumentTypeKey(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">문서 제목</label>
                      <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-800">템플릿 선택</label>
                      <EntityPicker
                        value={templateId}
                        options={templateOptions}
                        onChange={setTemplateId}
                        placeholder="템플릿을 선택하세요"
                        emptyMessage="저장된 템플릿이 없습니다."
                        allowClear
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">HTML 정본</label>
                    <textarea
                      value={htmlCanonical}
                      onChange={(event) => setHtmlCanonical(event.target.value)}
                      className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-800">라벨 값 JSON</label>
                    <textarea
                      value={labelValuesText}
                      onChange={(event) => setLabelValuesText(event.target.value)}
                      className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <Button onClick={handleCreateDocument} disabled={loading}>
                    문서 저장
                  </Button>
                  {latestCreated ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <p>최근 저장 문서: {latestCreated.document.title}</p>
                      <p>버전: {latestCreated.latestVersion.versionNumber}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {selectedDocumentDetail ? (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>버전 직접 추가</CardTitle>
                    <CardDescription>선택한 문서의 HTML 정본과 라벨 값을 직접 수정하는 고급 기능입니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">변경 사유</label>
                      <Input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">새 HTML 정본</label>
                      <textarea
                        value={versionHtmlCanonical}
                        onChange={(event) => setVersionHtmlCanonical(event.target.value)}
                        className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800">새 라벨 값 JSON</label>
                      <textarea
                        value={versionLabelValuesText}
                        onChange={(event) => setVersionLabelValuesText(event.target.value)}
                        className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <Button onClick={handleCreateVersion} disabled={loading}>
                      새 버전 저장
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle>현장 문서 목록</CardTitle>
                  <CardDescription>현재 현장의 전체 문서를 한 번에 확인하는 용도입니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-500">등록된 문서가 없습니다.</p>
                  ) : (
                    documents.map((item) => (
                      <div key={item.document.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getStatusVariant(item.document.status)}>{item.document.status}</Badge>
                          <span className="font-medium text-slate-900">{item.document.title}</span>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>문서 종류: {item.document.documentTypeKey}</p>
                          <p>최신 버전: {item.latestVersion?.versionNumber ?? '-'}</p>
                          <p>출력본 개수: {item.artifactCount}</p>
                        </div>
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDocumentId(item.document.id)}
                            disabled={loading}
                          >
                            이 문서로 작업하기
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
