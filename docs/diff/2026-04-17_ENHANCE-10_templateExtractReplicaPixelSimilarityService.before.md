# ENHANCE-10 삭제 기록

대상 파일: `src/services/templateExtractReplicaPixelSimilarityService.ts`

## 기록 목적

이 파일은 `v21` 에서 `hybrid bitmap/text-layer` 후보를 통과시키기 위한 실험용 untracked 파일이었다.
2026-04-17 `ENHANCE-10` 에서 사용자 요구에 따라 삭제했다.

## 삭제 사유

1. 최종 산출물이 실제 HTML 선/텍스트/셀 clone 이 아니라 image-first 경로로 기울었다.
2. 사용자 목표인 field tagging / bulk management / semantic ownership 을 직접 위반했다.
3. `v5`, `v20` 철학을 벗어난 실험 구현으로 판단했다.

## 삭제 직전 호출 계약

`src/services/templateExtractPdfService.ts` 에서 아래 형태로만 참조되었다.

```ts
const hybridQualityReport = TemplateExtractReplicaPixelSimilarityService.evaluateHybridReplica({
  candidateHtml: hybridArtifact.html,
  referencePageDataUrls: hybridArtifact.pageBackgroundDataUrls,
  minimumPassScore: 0.95,
});
```

## 복구 가능한 사실

1. 입력은 `candidateHtml`, `referencePageDataUrls`, `minimumPassScore` 였다.
2. 출력은 `TemplateExtractReplicaQualityReport` 호환 객체였고, `passed`, `summary.overallScore`, `mode='hybrid'` 를 포함했다.
3. 이 파일은 정식 git 추적 파일이 아니어서 exact source snapshot 은 저장소 이력에서 복원되지 않는다.
4. 동일한 실험 아이디어의 맥락은 [2026-04-17_ENHANCE-10_templateExtractPdfService.before.ts](/Users/gy/Documents/dev/docs/docs/diff/2026-04-17_ENHANCE-10_templateExtractPdfService.before.ts) 의 호출부와 [enhance.md](/Users/gy/Documents/dev/docs/docs/enhance.md) 의 폐기 섹션으로 추적한다.
