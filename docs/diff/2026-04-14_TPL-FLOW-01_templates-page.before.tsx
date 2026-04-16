'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { EntityPicker } from '../../components/ui/EntityPicker';
import { Input } from '../../components/ui/Input';
import type {
  TemplateDetailResult,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
} from '../../lib/templateDtos';

const defaultSourceContent = `<section>
  <h1>안전관리계획서</h1>
  <table>
    <tr>
      <th>현장명</th>
      <td>서울 A현장</td>
    </tr>
    <tr>
      <th>작업일</th>
      <td>2026-04-14</td>
    </tr>
    <tr>
      <th>안전책임자</th>
      <td>홍길동</td>
    </tr>
  </table>
</section>`;

const defaultDraftHtml = `<section data-template-root="true">
  <h1>안전관리계획서 템플릿</h1>
  <table>
    <tr>
      <th>현장명</th>
      <td><span data-label="site_name"></span></td>
    </tr>
    <tr>
      <th>작업일</th>
      <td><span data-label="work_date"></span></td>
    </tr>
  </table>
  <div data-signature-area="safety_manager_signature"></div>
</section>`;

const defaultFieldsJson = JSON.stringify(
  [
    {
      fieldKey: 'site_name',
      fieldType: 'text',
      fieldLabel: '현장명',
      labelKey: 'site_name',
      required: true,
      placeholder: '현장명을 입력하세요',
      layoutBlockId: 'site_name_cell',
      sortOrder: 1,
    },
    {
      fieldKey: 'work_date',
      fieldType: 'date',
      fieldLabel: '작업일',
      labelKey: 'work_date',
      required: true,
      layoutBlockId: 'work_date_cell',
      sortOrder: 2,
    },
  ],
  null,
  2
);

const defaultSignatureAreasJson = JSON.stringify(
  [
    {
      labelKey: 'safety_manager_signature',
      signerRoleName: '안전책임자',
      pageIndex: 1,
      x: 420,
      y: 280,
      width: 160,
      height: 60,
      required: true,
      sortOrder: 1,
    },
  ],
  null,
  2
);

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get('templateId')?.trim() || '';
  const [templateName, setTemplateName] = React.useState('안전관리계획서 템플릿');
  const [sourceDocumentName, setSourceDocumentName] = React.useState('안전관리계획서 원본.docx');
  const [sourceKind, setSourceKind] = React.useState<'html' | 'text'>('html');
  const [sourceContent, setSourceContent] = React.useState(defaultSourceContent);
  const [sourceFile, setSourceFile] = React.useState<File | null>(null);
  const [layoutResizeMode, setLayoutResizeMode] =
    React.useState<TemplateLayoutResizeMode>('grow_height');
  const [draftHtml, setDraftHtml] = React.useState(defaultDraftHtml);
  const [fieldsText, setFieldsText] = React.useState(defaultFieldsJson);
  const [signatureAreasText, setSignatureAreasText] = React.useState(defaultSignatureAreasJson);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState('');
  const [createdTemplate, setCreatedTemplate] = React.useState<TemplateRecordDto | null>(null);
  const [recentTemplates, setRecentTemplates] = React.useState<TemplateRecordDto[]>([]);
  const [templateDetail, setTemplateDetail] = React.useState<TemplateDetailResult | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const activeTemplateId = templateDetail?.template.id || selectedTemplateId.trim() || '';
  const currentTemplateSummary =
    templateDetail?.template ||
    recentTemplates.find((template) => template.id === activeTemplateId) ||
    createdTemplate ||
    recentTemplates[0] ||
    null;
  const templateOptions = React.useMemo(
    () =>
      recentTemplates.map((template) => ({
        id: template.id,
        label: template.templateName,
        meta: template.sourceDocumentName || template.id,
      })),
    [recentTemplates]
  );

  const syncTemplateQuery = React.useCallback((templateId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);

    if (templateId.trim()) {
      url.searchParams.set('templateId', templateId.trim());
    } else {
      url.searchParams.delete('templateId');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, []);

  const loadTemplate = React.useCallback(async (templateId: string) => {
    const normalizedTemplateId = templateId.trim();

    if (!normalizedTemplateId) {
      setTemplateDetail(null);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // TEMPLATE_DETAIL_NO_CACHE_REQUIRED
      // 필드 저장 직후 stale GET 응답을 재사용하지 않도록 cache bypass 를 강제합니다.
      const response = await fetch(`/api/templates/${normalizedTemplateId}?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 조회에 실패했습니다.');
      }

      setTemplateDetail(result.data);
      setSelectedTemplateId(normalizedTemplateId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 조회에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectTemplate = React.useCallback(
    async (templateId: string) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        return;
      }

      syncTemplateQuery(normalizedTemplateId);
      await loadTemplate(normalizedTemplateId);
      setMessage(`템플릿 ${normalizedTemplateId} 조회 완료`);
    },
    [loadTemplate, syncTemplateQuery]
  );

  const loadRecentTemplates = React.useCallback(
    async (preferredTemplateId?: string) => {
      try {
        const response = await fetch('/api/templates?limit=8', {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '최근 템플릿 목록 조회에 실패했습니다.');
        }

        const templates = (result.data || []) as TemplateRecordDto[];
        setRecentTemplates(templates);

        const nextTemplateId =
          preferredTemplateId?.trim() ||
          templateIdFromQuery ||
          selectedTemplateId.trim() ||
          templates[0]?.id ||
          '';

        if (!nextTemplateId) {
          return;
        }

        setSelectedTemplateId(nextTemplateId);

        if (!templateDetail || templateDetail.template.id !== nextTemplateId) {
          await loadTemplate(nextTemplateId);
        }
      } catch (error) {
        const nextMessage =
          error instanceof Error ? error.message : '최근 템플릿 목록 조회에 실패했습니다.';
        setMessage(nextMessage);
      }
    },
    [loadTemplate, selectedTemplateId, templateDetail, templateIdFromQuery]
  );

  React.useEffect(() => {
    void loadRecentTemplates(templateIdFromQuery || undefined);
  }, [loadRecentTemplates, templateIdFromQuery]);

  const handleCreateTemplate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          sourceDocumentName,
          draftHtml,
          layoutResizeMode,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 저장에 실패했습니다.');
      }

      setCreatedTemplate(result.data);
      setSelectedTemplateId(result.data.id);
      setMessage('템플릿 메타데이터와 레이아웃 초안이 저장되었습니다.');
      await loadTemplate(result.data.id);
      await loadRecentTemplates(result.data.id);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setLoading(true);
    setMessage(null);

    try {
      let result: any;

      if (sourceFile) {
        const formData = new FormData();
        formData.set('action', 'generate_draft');
        formData.set('sourceTitle', sourceDocumentName.trim());
        formData.set('file', sourceFile);

        const response = await fetch('/api/templates', {
          method: 'POST',
          body: formData,
        });

        result = await response.json();
      } else {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_draft',
            sourceTitle: sourceDocumentName,
            sourceKind,
            sourceContent,
          }),
        });

        result = await response.json();
      }

      if (!result.success) {
        throw new Error(result.message || 'HTML 초안 생성에 실패했습니다.');
      }

      const nextTemplateBaseName = String(result.data.sourceTitle || sourceDocumentName || '새 템플릿')
        .replace(/\.[a-z0-9]+$/i, '')
        .trim();
      const nextTemplateName = `${nextTemplateBaseName || '새 템플릿'} 템플릿`;

      setDraftHtml(result.data.draftHtml);
      setFieldsText(JSON.stringify(result.data.suggestedFields || [], null, 2));
      setSignatureAreasText(JSON.stringify(result.data.suggestedSignatureAreas || [], null, 2));
      setTemplateName((current) =>
        current === '안전관리계획서 템플릿' || !current.trim() ? nextTemplateName : current
      );
      setSourceDocumentName(result.data.sourceDocumentName || sourceDocumentName);
      setMessage('원본 문서에서 HTML 초안과 추천 필드가 생성되었습니다.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'HTML 초안 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFields = async () => {
    const normalizedTemplateId = selectedTemplateId.trim();

    if (!normalizedTemplateId) {
      setMessage('필드와 서명 영역을 저장할 templateId를 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/${normalizedTemplateId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: JSON.parse(fieldsText),
          signatureAreas: JSON.parse(signatureAreasText),
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 필드 저장에 실패했습니다.');
      }

      setMessage(
        `필드 ${result.data.savedFieldCount}개, 서명 영역 ${result.data.savedSignatureAreaCount}개, 라벨 바인딩 ${result.data.labelBindingCount}개를 저장했습니다.`
      );
      await loadTemplate(normalizedTemplateId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 필드 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-REG-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">템플릿 등록</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            템플릿 메타데이터, HTML 레이아웃 초안, 필드 스키마, 라벨 바인딩, 서명 영역을 저장하는 1차 골격입니다.
          </p>
          <p className="max-w-3xl text-xs text-slate-500">
            원본 문서를 올리거나 본문을 붙여 넣으면 HTML 초안을 먼저 만들고, 그 결과를 검토한 뒤 템플릿으로 저장합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadTemplate(selectedTemplateId)} disabled={loading}>
            템플릿 조회
          </Button>
          <Button variant="outline" onClick={handleGenerateDraft} disabled={loading}>
            HTML 초안 생성
          </Button>
          <Button onClick={handleCreateTemplate} disabled={loading}>
            템플릿 저장
          </Button>
        </div>
      </div>

      {message ? (
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 text-sm text-slate-700">{message}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>템플릿 메타데이터와 HTML 초안</CardTitle>
            <CardDescription>
              원본 문서를 올리거나 본문을 붙여 넣으면 HTML 레이아웃 초안을 먼저 생성하고, 그 결과를 검토한 뒤 저장합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">템플릿 이름</label>
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">원본 문서 이름</label>
                <Input
                  value={sourceDocumentName}
                  onChange={(event) => setSourceDocumentName(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">원본 파일 업로드</label>
              <input
                type="file"
                accept=".txt,.html,.htm,.docx,.pdf"
                onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-slate-500">
                파일을 선택하면 붙여넣기 본문보다 우선합니다. 현재는 txt, html, docx, pdf를 지원합니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">본문 붙여넣기 형식</label>
              <select
                value={sourceKind}
                onChange={(event) => setSourceKind(event.target.value as 'html' | 'text')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="html">html</option>
                <option value="text">text</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">원본 본문</label>
              <textarea
                value={sourceContent}
                onChange={(event) => setSourceContent(event.target.value)}
                className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">레이아웃 확장 정책</label>
              <select
                value={layoutResizeMode}
                onChange={(event) => setLayoutResizeMode(event.target.value as TemplateLayoutResizeMode)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="fixed">fixed</option>
                <option value="grow_height">grow_height</option>
                <option value="grow_width">grow_width</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Draft HTML</label>
              <textarea
                value={draftHtml}
                onChange={(event) => setDraftHtml(event.target.value)}
                className="flex min-h-[320px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 템플릿 저장 결과</CardTitle>
              <CardDescription>현재 선택된 템플릿의 핵심 메타데이터를 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {currentTemplateSummary ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">{currentTemplateSummary.status}</Badge>
                    <span className="font-medium text-slate-900">
                      {currentTemplateSummary.templateName}
                    </span>
                    {activeTemplateId ? <Badge variant="slate">선택됨</Badge> : null}
                  </div>
                  <p>템플릿 ID: {currentTemplateSummary.id}</p>
                  <p>레이아웃 정책: {currentTemplateSummary.layoutResizeMode}</p>
                  <p>원본 문서: {currentTemplateSummary.sourceDocumentName || '-'}</p>
                </>
              ) : (
                <p className="text-slate-500">아직 저장된 템플릿이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 템플릿 목록</CardTitle>
              <CardDescription>
                새로고침 후에도 최근 템플릿을 다시 열 수 있도록 목록을 유지합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {recentTemplates.length > 0 ? (
                recentTemplates.map((template) => (
                  <div
                    key={template.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={activeTemplateId === template.id}
                    onClick={() => void handleSelectTemplate(template.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleSelectTemplate(template.id);
                      }
                    }}
                    className={`flex w-full cursor-pointer flex-col rounded-lg border p-3 text-left transition ${
                      activeTemplateId === template.id
                        ? 'border-slate-400 bg-slate-100'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={template.status === 'active' ? 'green' : 'slate'}>
                            {template.status}
                          </Badge>
                          <span className="font-medium text-slate-900">{template.templateName}</span>
                          {activeTemplateId === template.id ? <Badge variant="slate">선택됨</Badge> : null}
                        </div>
                        <p className="text-xs text-slate-500">{template.id}</p>
                        <p className="text-xs text-slate-500">
                          {template.sourceDocumentName || '원본 문서 이름 없음'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleSelectTemplate(template.id);
                        }}
                        disabled={loading && activeTemplateId === template.id}
                      >
                        열기
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">저장된 템플릿 목록이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>필드 스키마와 서명 영역 저장</CardTitle>
              <CardDescription>
                `HTML 초안 생성` 결과를 먼저 검토한 뒤, 필요하면 필드/서명 영역 JSON을 조정하고 저장합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <EntityPicker
                  value={selectedTemplateId}
                  options={templateOptions}
                  onChange={setSelectedTemplateId}
                  placeholder="템플릿을 선택하세요"
                  emptyMessage="저장된 템플릿이 없습니다."
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSaveFields} disabled={loading}>
                  필드 저장
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">필드 스키마 JSON</label>
                <textarea
                  value={fieldsText}
                  onChange={(event) => setFieldsText(event.target.value)}
                  className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">서명 영역 JSON</label>
                <textarea
                  value={signatureAreasText}
                  onChange={(event) => setSignatureAreasText(event.target.value)}
                  className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>저장된 템플릿 상세</CardTitle>
              <CardDescription>
                필드 스키마, 라벨 바인딩, 서명 영역이 분리 저장되었는지 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templateDetail ? (
                <>
                  <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-900">{templateDetail.template.templateName}</p>
                    <p>템플릿 ID: {templateDetail.template.id}</p>
                    <p>레이아웃 정책: {templateDetail.template.layoutResizeMode}</p>
                    <p>필드 수: {templateDetail.fields.length}</p>
                    <p>라벨 바인딩 수: {templateDetail.labelBindings.length}</p>
                    <p>서명 영역 수: {templateDetail.signatureAreas.length}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">라벨 맵</p>
                    {templateDetail.labelMap.length === 0 ? (
                      <p className="text-sm text-slate-500">저장된 라벨 맵이 없습니다.</p>
                    ) : (
                      templateDetail.labelMap.map((entry) => (
                        <div key={entry.labelKey} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                          <p className="font-medium text-slate-900">{entry.labelKey}</p>
                          <p>필드 키: {entry.fieldKeys.join(', ') || '-'}</p>
                          <p>서명 영역 ID 수: {entry.signatureAreaIds.length}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">조회된 템플릿이 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
