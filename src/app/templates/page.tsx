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
  TemplateFieldInput,
  TemplateLayoutResizeMode,
  TemplateRecordDto,
  TemplateSignatureAreaInput,
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

const defaultFields: TemplateFieldInput[] = [
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
];

const defaultSignatureAreas: TemplateSignatureAreaInput[] = [
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
];

const renderPreview = (html: string) => {
  if (!html.trim()) {
    return <p className="text-sm text-slate-500">아직 생성된 HTML 초안이 없습니다.</p>;
  }

  return (
    <div
      className="prose prose-sm max-w-none text-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

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
  const [draftFields, setDraftFields] = React.useState<TemplateFieldInput[]>(defaultFields);
  const [draftSignatureAreas, setDraftSignatureAreas] =
    React.useState<TemplateSignatureAreaInput[]>(defaultSignatureAreas);
  const [advancedDraftHtml, setAdvancedDraftHtml] = React.useState(defaultDraftHtml);
  const [advancedFieldsText, setAdvancedFieldsText] = React.useState(JSON.stringify(defaultFields, null, 2));
  const [advancedSignatureAreasText, setAdvancedSignatureAreasText] = React.useState(
    JSON.stringify(defaultSignatureAreas, null, 2)
  );
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

  const syncFieldDrafts = React.useCallback((nextFields: TemplateFieldInput[]) => {
    setDraftFields(nextFields);
    setAdvancedFieldsText(JSON.stringify(nextFields, null, 2));
  }, []);

  const syncSignatureDrafts = React.useCallback((nextAreas: TemplateSignatureAreaInput[]) => {
    setDraftSignatureAreas(nextAreas);
    setAdvancedSignatureAreasText(JSON.stringify(nextAreas, null, 2));
  }, []);

  const syncDraftHtml = React.useCallback((nextDraftHtml: string) => {
    setDraftHtml(nextDraftHtml);
    setAdvancedDraftHtml(nextDraftHtml);
  }, []);

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

  const loadTemplate = React.useCallback(
    async (templateId: string) => {
      const normalizedTemplateId = templateId.trim();

      if (!normalizedTemplateId) {
        setTemplateDetail(null);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch(`/api/templates/${normalizedTemplateId}?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || '템플릿 조회에 실패했습니다.');
        }

        setTemplateDetail(result.data);
        setSelectedTemplateId(normalizedTemplateId);
        syncDraftHtml(result.data.template.draftHtml);
        syncFieldDrafts(
          result.data.fields.map((field: TemplateDetailResult['fields'][number]) => ({
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            fieldLabel: field.fieldLabel,
            labelKey: field.fieldKey,
            required: field.required,
            placeholder: field.placeholder,
            defaultValue: field.defaultValue,
            options: field.options,
            layoutBlockId: field.layoutBlockId,
            sortOrder: field.sortOrder,
          }))
        );
        syncSignatureDrafts(
          result.data.signatureAreas.map((area: TemplateDetailResult['signatureAreas'][number]) => ({
            labelKey: area.labelKey,
            signerRoleName: area.signerRoleName,
            pageIndex: area.pageIndex,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            required: area.required,
            sortOrder: area.sortOrder,
          }))
        );
      } catch (error) {
        const nextMessage = error instanceof Error ? error.message : '템플릿 조회에 실패했습니다.';
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    },
    [syncDraftHtml, syncFieldDrafts, syncSignatureDrafts]
  );

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

      syncDraftHtml(result.data.draftHtml);
      syncFieldDrafts(result.data.suggestedFields || []);
      syncSignatureDrafts(result.data.suggestedSignatureAreas || []);
      setTemplateName((current) =>
        current === '안전관리계획서 템플릿' || !current.trim() ? nextTemplateName : current
      );
      setSourceDocumentName(result.data.sourceDocumentName || sourceDocumentName);
      setMessage('원본 문서를 읽어 HTML 초안과 추천 입력 항목을 만들었습니다.');
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'HTML 초안 생성에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const createResponse = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          sourceDocumentName,
          draftHtml,
          layoutResizeMode,
        }),
      });
      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.message || '템플릿 저장에 실패했습니다.');
      }

      const template = createResult.data as TemplateRecordDto;

      setCreatedTemplate(template);
      setSelectedTemplateId(template.id);

      const fieldsResponse = await fetch(`/api/templates/${template.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: draftFields,
          signatureAreas: draftSignatureAreas,
        }),
      });
      const fieldsResult = await fieldsResponse.json();

      if (!fieldsResult.success) {
        throw new Error(fieldsResult.message || '템플릿 필드 저장에 실패했습니다.');
      }

      setMessage(
        `템플릿 저장 완료. 필드 ${fieldsResult.data.savedFieldCount}개, 서명 영역 ${fieldsResult.data.savedSignatureAreaCount}개를 함께 저장했습니다.`
      );
      await loadTemplate(template.id);
      await loadRecentTemplates(template.id);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFields = async () => {
    const normalizedTemplateId = selectedTemplateId.trim();

    if (!normalizedTemplateId) {
      setMessage('항목을 다시 저장할 템플릿을 먼저 선택하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/templates/${normalizedTemplateId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: draftFields,
          signatureAreas: draftSignatureAreas,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '템플릿 필드 저장에 실패했습니다.');
      }

      setMessage(
        `항목 다시 저장 완료. 필드 ${result.data.savedFieldCount}개, 서명 영역 ${result.data.savedSignatureAreaCount}개`
      );
      await loadTemplate(normalizedTemplateId);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : '템플릿 필드 저장에 실패했습니다.';
      setMessage(nextMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvancedFieldsChange = (value: string) => {
    setAdvancedFieldsText(value);

    try {
      const parsed = JSON.parse(value) as TemplateFieldInput[];

      if (Array.isArray(parsed)) {
        setDraftFields(parsed);
      }
    } catch {
      // keep raw text until it becomes valid json again
    }
  };

  const handleAdvancedSignatureAreasChange = (value: string) => {
    setAdvancedSignatureAreasText(value);

    try {
      const parsed = JSON.parse(value) as TemplateSignatureAreaInput[];

      if (Array.isArray(parsed)) {
        setDraftSignatureAreas(parsed);
      }
    } catch {
      // keep raw text until it becomes valid json again
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="slate">TPL-FLOW-01</Badge>
          <h1 className="text-3xl font-semibold text-slate-950">템플릿 등록</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            원본 문서를 올리면 HTML 초안을 만들고, 같은 화면에서 검토 후 바로 템플릿으로 저장합니다.
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

      <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>원본 문서 입력</CardTitle>
              <CardDescription>파일 업로드 또는 본문 붙여넣기 중 편한 방법 하나만 쓰면 됩니다.</CardDescription>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">본문 형식</label>
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
              </div>

              <details className="rounded-lg border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">원본 본문 직접 붙여넣기</summary>
                <div className="mt-3">
                  <textarea
                    value={sourceContent}
                    onChange={(event) => setSourceContent(event.target.value)}
                    className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>생성된 HTML 초안</CardTitle>
              <CardDescription>왼쪽에서 초안을 크게 보고, 오른쪽에서 저장만 결정하면 됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[420px] rounded-xl border border-slate-200 bg-white p-6">
                {renderPreview(draftHtml)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>저장 준비</CardTitle>
              <CardDescription>생성된 초안, 필드, 서명 영역 수를 보고 그대로 저장할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>추천 입력 항목: {draftFields.length}개</p>
              <p>추천 서명 영역: {draftSignatureAreas.length}개</p>
              <p>현재 레이아웃 정책: {layoutResizeMode}</p>
              {currentTemplateSummary ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="green">{currentTemplateSummary.status}</Badge>
                    <span className="font-medium text-slate-900">{currentTemplateSummary.templateName}</span>
                  </div>
                  <p>최근 선택 템플릿: {currentTemplateSummary.id}</p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>추천 입력 항목</CardTitle>
              <CardDescription>대부분은 여기서 확인만 하고 바로 저장하면 됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftFields.length > 0 ? (
                draftFields.map((field) => (
                  <div key={field.fieldKey} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Badge variant="slate">{field.fieldType}</Badge>
                      <span className="font-medium text-slate-900">{field.fieldLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">labelKey: {field.labelKey}</p>
                    <p className="text-xs text-slate-500">required: {field.required ? 'yes' : 'no'}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">생성된 추천 입력 항목이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>추천 서명 영역</CardTitle>
              <CardDescription>서명이 필요한 양식이면 자동으로 함께 저장됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftSignatureAreas.length > 0 ? (
                draftSignatureAreas.map((area) => (
                  <div key={`${area.labelKey}-${area.sortOrder || 0}`} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{area.signerRoleName}</p>
                    <p className="text-xs text-slate-500">labelKey: {area.labelKey}</p>
                    <p className="text-xs text-slate-500">
                      좌표: {area.x}, {area.y} / {area.width} × {area.height}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">추천 서명 영역이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>최근 템플릿</CardTitle>
              <CardDescription>이미 저장된 템플릿을 다시 열거나 항목을 덮어쓸 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                  현재 항목 다시 저장
                </Button>
              </div>
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
                    className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                      activeTemplateId === template.id
                        ? 'border-slate-400 bg-slate-100'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={template.status === 'active' ? 'green' : 'slate'}>
                        {template.status}
                      </Badge>
                      <span className="font-medium text-slate-900">{template.templateName}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{template.sourceDocumentName || template.id}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">저장된 템플릿이 없습니다.</p>
              )}
            </CardContent>
          </Card>

          <details className="rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">고급 편집</summary>
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">Draft HTML</label>
                <textarea
                  value={advancedDraftHtml}
                  onChange={(event) => syncDraftHtml(event.target.value)}
                  className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">필드 스키마 JSON</label>
                <textarea
                  value={advancedFieldsText}
                  onChange={(event) => handleAdvancedFieldsChange(event.target.value)}
                  className="flex min-h-[180px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">서명 영역 JSON</label>
                <textarea
                  value={advancedSignatureAreasText}
                  onChange={(event) => handleAdvancedSignatureAreasChange(event.target.value)}
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
