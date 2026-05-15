# /templates/extract 저장 직전 HTML 처리 백업

대상 파일: `src/app/templates/extract/page.tsx`

백업 목적:
- 저장 직전 `generatedDraftHtml` 전송 구간만 경제적으로 보관
- `/templates/extract`만 수정하다가 저장 경로가 깨지면 즉시 복구 가능하게 함

원본 구간:

```tsx
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
    const response = await fetch(`/api/templates/extract/${currentDraft.draft.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateName: templateName.trim(),
        layoutResizeMode: FIXED_LAYOUT_RESIZE_MODE,
        generatedDraftHtml: currentDraftHtml.trim(),
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
```
