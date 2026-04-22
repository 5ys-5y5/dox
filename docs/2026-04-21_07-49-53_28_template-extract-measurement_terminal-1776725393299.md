# Template Extract Visual Measurement Log

- startedAt: 2026-04-20T22:49:53.299Z
- draftId: terminal-1776725393299
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 28

## Events

### 2026-04-20T22:49:53.300Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_대구침산더샵.pdf / engineVersion=28

```json
{
  "filePath": "docs/작업지시서_대구침산더샵.pdf",
  "fileName": "작업지시서_대구침산더샵.pdf",
  "version": "28"
}
```

### 2026-04-20T22:51:32.013Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_segment_text_layer_digital / htmlLength=1207096

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "28",
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
    "cloneBuilder": "work_order_family_frame_segment_text_layer_digital",
    "frameDiagnostics": {
      "policy": "mask_vector_priority",
      "source": "mask_vector",
      "segmentCount": 6088,
      "horizontalSegmentCount": 4921,
      "verticalSegmentCount": 1167,
      "maskVectorEnabled": true,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": 2
    }
  }
}
```

### 2026-04-20T22:51:59.339Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-20T22:52:29.188Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 39.12%
- errorMessage: -

### Visual Similarity Report

```json
{
  "tolerancePx": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v28"
  ],
  "minimumPassScore": 0.9,
  "measuredAt": "2026-04-20T22:52:29Z",
  "measured": true,
  "measurementMode": "server_swift_template_render",
  "passed": false,
  "pageReports": [
    {
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "exactOverlapRatio": 0.3129454731096232,
      "pageNumber": 1,
      "replicaInkPixelCount": 240697,
      "sourceInkPixelCount": 427973,
      "overlapInkPixelCount": 199214,
      "unionInkPixelCount": 509290,
      "height": 1684,
      "width": 1190,
      "exactOverlapInkPixelCount": 159380,
      "overlapRatio": 0.39116024269080485,
      "mismatchRatio": 0.6088397573091952
    }
  ],
  "pageCount": 1,
  "overallScore": 0.39116024269080485
}
```
