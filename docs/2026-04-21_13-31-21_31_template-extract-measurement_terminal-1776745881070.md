# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T04:31:21.070Z
- draftId: terminal-1776745881070
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T04:31:21.071Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_사일동 주상복합.pdf / engineVersion=31

```json
{
  "filePath": "docs/작업지시서_사일동 주상복합.pdf",
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "version": "31"
}
```

### 2026-04-21T04:33:16.666Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_table_fragment_frame_mask_edge_text_layer_digital / htmlLength=44905

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "31",
    "sourceMode": "digital",
    "documentFamily": "work_order",
    "familyConfidenceScore": 0.99,
    "familyDetectionReasons": [
      "source-mode:text-pages(1)",
      "source-hint:작업지시서",
      "text-signal:작업지시서",
      "text-signal:공사내용",
      "text-signal:하도급대금",
      "text-signal:공사착수일",
      "text-signal:공사완료일",
      "text-signal:발급자서명",
      "text-signal:ce",
      "text-signal:pm"
    ],
    "topologySummary": {
      "pageCount": 1,
      "rowBandCount": 35,
      "columnEdgeCount": 25,
      "horizontalSegmentCount": 0,
      "verticalSegmentCount": 0,
      "textBlockCount": 72,
      "cellCandidateCount": 72
    },
    "cloneBuilder": "work_order_family_table_fragment_frame_mask_edge_text_layer_digital",
    "frameDiagnostics": {
      "policy": "table_fragmented_rule_geometry_mask_edges",
      "source": "mixed",
      "segmentCount": 31,
      "horizontalSegmentCount": 18,
      "verticalSegmentCount": 13,
      "maskVectorEnabled": true,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": 18,
      "fragmentCount": 13,
      "giantTableRejected": true
    }
  }
}
```

### 2026-04-21T04:33:49.731Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T04:34:24.319Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 42.94%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measurementMode": "server_swift_template_render",
  "pageReports": [
    {
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "height": 1684,
      "overlapRatio": 0.4293842680068724,
      "pageNumber": 1,
      "width": 1190,
      "mismatchRatio": 0.5706157319931275,
      "unionInkPixelCount": 466794,
      "overlapInkPixelCount": 200434,
      "exactOverlapRatio": 0.3273863845722096,
      "sourceInkPixelCount": 405356,
      "exactOverlapInkPixelCount": 152822,
      "replicaInkPixelCount": 214260
    }
  ],
  "measured": true,
  "measuredAt": "2026-04-21T04:34:24Z",
  "overallScore": 0.4293842680068724,
  "passed": false,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v31"
  ],
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "pageCount": 1
}
```
