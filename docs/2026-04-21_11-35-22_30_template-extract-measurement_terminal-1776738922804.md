# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T02:35:22.804Z
- draftId: terminal-1776738922804
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 30

## Events

### 2026-04-21T02:35:22.805Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_대구침산더샵.pdf / engineVersion=30

```json
{
  "filePath": "docs/작업지시서_대구침산더샵.pdf",
  "fileName": "작업지시서_대구침산더샵.pdf",
  "version": "30"
}
```

### 2026-04-21T02:36:51.444Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_table_fragment_frame_text_layer_digital / htmlLength=51642

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "30",
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
    "cloneBuilder": "work_order_family_table_fragment_frame_text_layer_digital",
    "frameDiagnostics": {
      "policy": "table_fragmented_rule_geometry",
      "source": "rule_geometry",
      "segmentCount": 75,
      "horizontalSegmentCount": 33,
      "verticalSegmentCount": 42,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null,
      "fragmentCount": 23,
      "giantTableRejected": true
    }
  }
}
```

### 2026-04-21T02:37:14.701Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T02:37:39.203Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 28.00%
- errorMessage: -

### Visual Similarity Report

```json
{
  "passed": false,
  "measurementMode": "server_swift_template_render",
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v30"
  ],
  "minimumPassScore": 0.95,
  "pageCount": 1,
  "pageReports": [
    {
      "width": 1190,
      "pageNumber": 1,
      "overlapRatio": 0.28004727592720097,
      "height": 1684,
      "unionInkPixelCount": 543194,
      "replicaInkPixelCount": 220846,
      "sourceInkPixelCount": 427973,
      "overlapInkPixelCount": 152120,
      "exactOverlapRatio": 0.19445170602031686,
      "mismatchRatio": 0.719952724072799,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "exactOverlapInkPixelCount": 105625
    }
  ],
  "overallScore": 0.28004727592720097,
  "tolerancePx": 1,
  "measuredAt": "2026-04-21T02:37:39Z",
  "measured": true
}
```
