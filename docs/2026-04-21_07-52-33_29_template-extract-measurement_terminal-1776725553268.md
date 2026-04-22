# Template Extract Visual Measurement Log

- startedAt: 2026-04-20T22:52:33.268Z
- draftId: terminal-1776725553268
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 29

## Events

### 2026-04-20T22:52:33.269Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_대구침산더샵.pdf / engineVersion=29

```json
{
  "filePath": "docs/작업지시서_대구침산더샵.pdf",
  "fileName": "작업지시서_대구침산더샵.pdf",
  "version": "29"
}
```

### 2026-04-20T22:54:18.047Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_rule_geometry_text_layer_digital / htmlLength=66431

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "29",
    "sourceMode": "digital",
    "documentFamily": "work_order",
    "familyConfidenceScore": 0.99,
    "familyDetectionReasons": [
      "source-mode:text-pages(1)",
      "source-hint:작업지시서",
      "text-signal:작업지시서",
      "text-signal:공사내용",
      "text-signal:대표수량및단가",
      "text-signal:하도급대금",
      "text-signal:공사착수일",
      "text-signal:공사완료일",
      "text-signal:발급자서명",
      "text-signal:ce",
      "text-signal:pm"
    ],
    "topologySummary": {
      "pageCount": 1,
      "rowBandCount": 34,
      "columnEdgeCount": 24,
      "horizontalSegmentCount": 0,
      "verticalSegmentCount": 0,
      "textBlockCount": 69,
      "cellCandidateCount": 69
    },
    "cloneBuilder": "work_order_family_frame_rule_geometry_text_layer_digital",
    "frameDiagnostics": {
      "policy": "rule_geometry_only",
      "source": "rule_geometry",
      "segmentCount": 148,
      "horizontalSegmentCount": 59,
      "verticalSegmentCount": 89,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null
    }
  }
}
```

### 2026-04-20T22:54:48.509Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-20T22:55:33.172Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 27.94%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "overallScore": 0.2793555843766267,
  "measurementMode": "server_swift_template_render",
  "tolerancePx": 1,
  "pageCount": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v29"
  ],
  "pageReports": [
    {
      "overlapRatio": 0.2793555843766267,
      "mismatchRatio": 0.7206444156233733,
      "overlapInkPixelCount": 158315,
      "height": 1684,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "pageNumber": 1,
      "replicaInkPixelCount": 248261,
      "exactOverlapInkPixelCount": 109519,
      "exactOverlapRatio": 0.19325234024156762,
      "width": 1190,
      "unionInkPixelCount": 566715,
      "sourceInkPixelCount": 427973
    }
  ],
  "measuredAt": "2026-04-20T22:55:33Z",
  "passed": false,
  "minimumPassScore": 0.9
}
```
